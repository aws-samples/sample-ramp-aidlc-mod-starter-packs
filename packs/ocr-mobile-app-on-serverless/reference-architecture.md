# Reference Architecture — Mobile Document Capture on Serverless

A serverless computer-vision pipeline that turns captured images of printed/handwritten
forms into structured, validated data, with a human-in-the-loop review step. This is a
reference shape — the design phase decides the concrete services and topology for your project.

```mermaid
%%{init: {'flowchart': {'nodeSpacing': 60, 'rankSpacing': 70, 'padding': 12}, 'themeVariables': {'fontSize': '18px'}}}%%
flowchart TB
    user(["Review User"])

    subgraph ingest["Ingestion & Preprocessing"]
        s3raw[("S3<br/>Raw Form Images")]
        lpre["Lambda<br/>Preprocessing<br/>(Quality Check)"]
        s3proc[("S3<br/>Processed Images")]
    end

    subgraph cv["CV Pipeline (Step Functions)"]
        sfn{{"Step Functions<br/>CV Pipeline Orchestrator"}}
        textract["Amazon Textract<br/>OCR + Layout"]
        lcheck["Lambda<br/>Checkbox Detection"]
        bedrock["Amazon Bedrock<br/>Layout Understanding<br/>+ Handwriting"]
        lsku["Lambda<br/>Catalog Reconciliation<br/>+ Math Check"]
    end

    subgraph review["Human Review"]
        ddb[("DynamoDB<br/>Results<br/>+ Catalog")]
        eb["EventBridge<br/>Human Review Trigger"]
        apigw["API Gateway + Lambda<br/>Review UI Backend"]
        cf["CloudFront + S3<br/>React/Vue UI"]
    end

    cw["CloudWatch<br/>Monitoring"]

    %% Data flow
    s3raw -->|S3 Event| lpre --> s3proc
    s3proc -->|S3 Event| sfn

    %% CV workstreams
    sfn -. "OCR + spatial layout" .-> textract
    sfn -. "mark / checkbox detection" .-> lcheck
    sfn -. "layout inference + handwriting" .-> bedrock
    sfn -. "catalog + math reconciliation" .-> lsku

    sfn ==>|Write Results| ddb
    ddb -->|Stream| eb -->|Invoke| apigw -->|REST API| cf
    user ==>|HTTPS| cf

    apigw -. monitoring .-> cw

    classDef compute fill:#FF9900,stroke:#232F3E,color:#232F3E;
    classDef storage fill:#3F8624,stroke:#232F3E,color:#fff;
    classDef ml fill:#01A88D,stroke:#232F3E,color:#fff;
    classDef integration fill:#E7157B,stroke:#232F3E,color:#fff;

    class lpre,lcheck,lsku,apigw,sfn compute;
    class s3raw,s3proc,ddb,cf storage;
    class textract,bedrock ml;
    class eb,cw integration;
```

## Legend

- **Solid arrows** — Data flow
- **Dotted arrows** — CV workstream fan-out (Step Functions)
- **Thin dotted line** — Monitoring (CloudWatch)

## Workstreams

A typical extraction pipeline decomposes into independent workstreams that the Step Functions
orchestrator fans out and merges:

1. **Image capture & pre-processing** — multi-page capture with on-device quality gating (blur/glare/coverage checks, edge detection, perspective correction) before upload.
2. **OCR with spatial preservation** — layout-aware OCR that returns bounding boxes per token/line.
3. **Layout understanding** — infer table/structure from the page when the template is unknown.
4. **Checkbox / mark detection** — detect which items/rows are selected.
5. **Handwritten quantity recognition** — read handwritten values.
6. **Catalog reconciliation** — match extracted text to a reference catalog (e.g. embedding similarity over name + variant + size).
7. **Math reconciliation** — validate arithmetic (e.g. `qty × unit_price ≈ line_total`; sum of line totals ≈ printed total, within rounding tolerance).
8. **Human-in-the-loop review** — the user edits and confirms the digitized result before it is accepted.

## Cost note

Serverless, pay-per-use pricing keeps a low-volume workload inexpensive and maintenance-free
compared with an always-on compute equivalent. Bedrock/Textract calls typically dominate cost —
validate current pricing and regional availability against the AWS Knowledge MCP for your target
region and volume before committing to a design.
