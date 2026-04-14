# Decisions

## What insight from the data drove my decisions

The usage data pointed to two problems. The most widespread was re-uploads: 76% of all document uploads were redundant, affecting 29 of ~50 beta users uploading the same files across different conversations. I addressed this as a quick win alongside the multi-document feature - a "Your documents" panel letting users reattach previous files without re-uploading. The more severe problem came from the customer feedback. Two partners - not associates, the budget holders who decide whether a firm renews - had already lost trust in the product due to unverifiable AI responses. One had stopped recommending it entirely. In their words: "being confidently wrong is worse than being slow."

## Why I chose this over other options

I considered a confidence indicator to address the trust problem but ruled it out - a model that hallucinates confidently will also self-report high confidence on fabricated answers, which gives lawyers false reassurance on exactly the responses they should question. Instead I built verifiable inline citation: the model returns the verbatim passage supporting its answer, with document name and page number, rendered as a pull-quote block with a one-click "View" button that jumps the document viewer to that page. When the model can't ground an answer in a specific passage it says so explicitly rather than hiding the uncertainty. I deliberately skipped a full RAG pipeline - for the document sizes in scope the model handles full text accurately within its context window, and prompt-based citation is good enough to be genuinely useful at this scale.

## What I'd do next with more time

With more time I'd replace prompt-based citation with proper RAG - chunking documents on upload, embedding them, and retrieving at the clause level rather than the page level. That's the difference between a useful reference and a genuinely trustworthy one for lawyers on a £40M acquisition. I'd also build a full document library where documents are managed independently of conversations and reusable across deals, and add report export so lawyers can compile answers into a Word document rather than copy-pasting from chat.


## LOOM
https://www.loom.com/share/783fbaf0bb93460f99e452d9dc39eeef
