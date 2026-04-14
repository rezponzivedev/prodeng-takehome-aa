# Production RAG-to-SQL System with Integrated AI Evaluation Framework

## 1. Problem & Context

At Sports Kinetic, we were building tools used by professional football clubs for player analytics and recruitment. Analysts needed to query large, complex datasets containing player statistics, match data, and competition context across tens of thousands of players worldwide.

Before this system existed, analysts had no clean way to query the data at all. Much of it lived in raw JSON and CSV exports. To do anything meaningful they needed to load it into dataframes, wrangle it into shape, and write custom analysis scripts. In a time-sensitive scouting environment, that effectively locked non-technical staff out of the data entirely.

We set out to enable natural language queries such as: *"Show me midfielders who can progress the ball, weighted by competition strength, with fewer than 10 starts."*

The deeper challenge was not just enabling natural language queries - it was making LLM-driven systems reliable enough for professional use. Incorrect or inconsistent results would quickly erode trust and render the system unusable.

## 2. Complexity & Constraints

The core technical challenges were LLM reliability - translating natural language into correct, executable SQL can be error-prone, with failures including invalid syntax, incorrect joins, and semantically wrong queries. Schema complexity, with numerous tables and complex relationships, made accurate generation difficult without careful context design. Non-deterministic model behaviour made debugging hard, and latency constraints meant the system needed to feel responsive despite multiple AI calls per request.

I was the sole engineer responsible end-to-end, with no one to hand work off to - solutions needed to be pragmatic and entirely self-owned.

## 3. Approach

As the sole engineer on this project, I designed and built a production RAG-to-SQL system with an integrated evaluation framework, focused not just on generating SQL but on making the system measurable, debuggable, and continuously improvable.

The retrieval layer provided the LLM with relevant schema subsets, table relationships, and column descriptions - enough context to generate accurate SQL without being overwhelmed by the full schema. All generated SQL passed through syntax and security validation before execution. Invalid queries triggered a retry loop; through testing I found three attempts maximised recovery without unacceptable latency, with a graceful fallback if all attempts failed.

The most critical component was an observability layer built on Elasticsearch and Kibana, logging 30+ structured fields per request - including query success, retry count, latency, SQL complexity, tables accessed, and explicit user feedback. A key design decision was separating model success from user-perceived success: a syntactically valid query could still be useless, and tracking both allowed optimisation for real user value. End-to-end request tracing via unique IDs allowed us to follow any query through the full pipeline.

A late but important addition was CSV export of the raw statistics behind each result. Analysts told us they couldn't bring findings to colleagues without verifiable data - an AI-generated answer alone wasn't credible in a meeting. This bridged the gap between discovery and decision-making.

## 4. Impact

The system was deployed to production and used by professional football clubs across the English football pyramid, including Premier League and Championship sides.

- Enabled non-technical analysts to run complex, weighted queries without any programming knowledge - replacing hours of manual data wrangling with seconds
- Query success rate improved significantly over six weeks of iteration, driven by the observability framework surfacing the most common failure patterns
- Evaluation dashboards allowed prompt and context improvements to be prioritised by actual impact rather than guesswork
- CSV export directly addressed analyst feedback, closing the loop between AI-assisted discovery and real-world decision-making

The observability layer proved as valuable as the core functionality - without it, we would have been improving the system blind.

## 5. Reflection

If I were to build this again, I would make two changes.

1. **A conversational interaction model.** The single-turn interface limited users to one query at a time. A conversational approach would let analysts iteratively refine results - "show me the same list but only under 23s" - significantly improving success rates for complex or ambiguous requests.

2. **Error-aware retries.** The current retry loop resubmitted the original query without additional context. Feeding the error back to the model on each retry would give it the information needed to self-correct rather than repeat the same mistake.
