# AIDLC Hands-On Workshop Sample Steps (Kiro Spec) — Updated 2026.2.23

## Step 1 — Requirements Analysis

### Step 1.1 Input Requirements

Based on Kiro Spec, provide a requirements prompt and refine the requirements through a Q&A process.

**Sample prompt in Spec mode:**

Your role: You are a professional Product Manager responsible for creating well-defined user stories that will serve as the contract for developing the system described in the Task section below.

Create a plan for the upcoming work and write your steps in the requirements plan file **requirements_plan.md**, adding a checkbox for each step. If any step requires my clarification, add a question with a [Question] tag and create an empty [Answer] tag for me to fill in.

_If my answer to any question is unclear, add **Updated** to the original question in **requirements_plan.md** and append a follow-up question, then notify me. You may also append additional questions in **requirements_plan.md** and iterate through multiple rounds until you fully understand my intent._

Additionally, to facilitate subsequent steps, _you should also ask questions about non-functional requirements._ Do not make key decisions on your own.

Once the plan is complete, request my review and approval. After I approve, you may execute the plan step by step and output the requirements document in Chinese. After completing each step, mark the corresponding checkbox in the plan as done.

Your task: Based on the high-level requirements described in the Product Description, create Requirements in the Spec.

## Product Description:
Build an internal employee benefits e-commerce website called AWSomeShop. The project aims to validate the business model of an employee points redemption system through a Minimum Viable Product (MVP).

## Core Features:
- Employees:
  - Can browse and redeem a small selection of pre-selected products using their "AWSome Points."
  - Can view their points balance and redemption history.
- Administrators:
  - Can manually configure product information.
  - Can manually manage employee "AWSome Points" (issue and deduct).

### Step 1.2 Clarify the Requirements Plan

Answer all questions in the [Answer] sections of requirements_plan.md. For anything unclear, you can ask the AI to provide suggestions.

Then ask the AI: **"I have answered the questions in [Answer]. Are there any other questions that need my clarification? Please append them in requirements_plan.md."** (Multiple rounds of clarification may be needed.)

### Step 1.3 Generate the Requirements Document

Once the AI confirms that clarification is complete — for example: "Perfect! I have collected all the necessary information. There are no more questions that need your clarification." — you can prompt the AI to proceed with generating the requirements document (i.e., the requirements.md file).

### Step 1.4 Provide Feedback on the Requirements Document

Review whether the descriptions in requirements.md are correct and complete. For anything that needs modification, use a [Feedback] tag to provide your revision comments.

Then ask the AI: **"I have provided [Feedback] on the Requirements. Please update accordingly."**

## Step 2 — Architecture Design

### Step 2.1 Begin Design

When the AI indicates that the requirements have been finalized — for example: "The requirements document is now complete. Does it meet your expectations? If so, we can proceed to the design phase." — you can instruct the AI to begin the design.

**Sample prompt in Spec mode:**

The design phase requires you to ask design questions and write your steps in the design plan file **design_plan.md**, adding a checkbox for each step. If any step requires my clarification, add a question with a [Question] tag and create an empty [Answer] tag for me to fill in.

_If my answer to any question is unclear, add **Updated** to the original question in **design_plan.md** and append a follow-up question, then notify me. You may also append additional questions in **design_plan.md** and iterate through multiple rounds until you fully understand my intent. Do not make key decisions on your own._

Once the plan is complete, request my review and approval. After I approve, you may execute the plan step by step. After completing each step, mark the corresponding checkbox in the plan as done.

### Step 2.2 Clarify Design Questions

Answer all questions in the [Answer] sections of design_plan.md. For anything unclear, you can ask the AI to provide suggestions.

Then ask the AI: **"I have answered the questions in [Answer]. Are there any other questions that need my clarification? Please append them in design_plan.md."** (Multiple rounds of clarification may be needed.)

### Step 2.3 Generate the Design Document

Prompt the AI to generate the design document (i.e., the design.md file).

### Step 2.4 Provide Feedback on the Design Document

Review whether the descriptions in design.md are correct and complete. For anything that needs modification, use a [Feedback] tag to provide your revision comments.

Then ask the AI: **"I have provided [Feedback] on the Design. Please update accordingly."**

### Step 2.6 Generate Architecture Diagrams (Optional)

Prompt the AI: **"Apply the C4 model to generate Mermaid architecture diagrams from the Design."** Click preview to view the design architecture diagrams.

### Step 2.7 (Optional) Security Review of the Design

Use the **AWS Security Agent** to create a new **Agent Space**, upload the design.md file to the AWS Security Agent, and perform a **Design Review** ([doc](https://docs.aws.amazon.com/securityagent/latest/userguide/perform-design-review.html)).

## Step 3 — Task Breakdown and Execution

### Step 3.1 Create the Task List

After the design is finalized, the AI will ask: "The design document is now complete. Does it meet your expectations? If so, we can proceed to create the implementation task list."

**Sample prompt in Spec mode:**

**When breaking down tasks, pay attention to dependencies between tasks. Group tasks that can be executed in parallel and label these parallelizable task groups, so they can be processed concurrently to reduce delivery time.**

### Step 3.2 Modify Tasks

Review the generated task list and revise or supplement steps as needed. If the task breakdown is good, it will include all tasks. If you find any tasks missing, use a [Feedback] tag to provide your revision comments.

Then ask the AI: **"I have provided [Feedback] on the Task list. Please update accordingly."**

You can also use a separate session in Vibe mode or QCli to execute tasks independently. Below are two examples.

### Step 3.3 Execute Generated Tasks

Click "Start task" on each task in the task list one by one, and review the execution results.

***Note: For generated code, each module needs to be reviewed and evaluated: Is the AI's design reasonable? Is the generated code high quality? How does it compare to what a human programmer would write? You can retry and compare the generated content repeatedly.***

### Step 3.4 (Optional) Code Review by Creating a Kiro Custom Subagent

Chat with Kiro: Create a "Code Review Expert" Subagent.

*Check whether Kiro has created a new agent file in the .kiro/agent directory. You can further configure team coding standards.*

Have Kiro automatically invoke this Subagent the next time code is committed to review the code. It will check according to your standards: whether naming is consistent, whether comments are complete, whether there are potential bugs, etc.

### Step 3.5 (Optional) Code Review with Security Agent

Use the **AWS Security Agent** to perform a Code Review ([doc](https://docs.aws.amazon.com/securityagent/latest/userguide/review-code-findings-github.html)) when submitting a Pull Request to GitHub. You can customize the review execution standards and project specifications.

## Step 4 — Testing and Debugging

Run the project locally, log in, access it, and test. Submit any error messages to the AI for debugging assistance.

**Note:** You can have the AI start the project and run the front-end and back-end, providing a local test URL. You can go further by using prompts to have the AI perform automated **end-to-end local testing**. For browser automation testing, two recommended **MCPs are: chrome-devtools MCP or playwright MCP**.

Optional: Use [Property-based tests](https://kiro.dev/docs/specs/correctness/) to enrich test coverage.

## Step 5 — Deployment and Monitoring

### Step 5.1 Deploy to the Cloud

Use Kiro to generate **automated deployment** CDK and deploy to the cloud.

### Step 5.2 Deploy CloudWatch Monitoring

Use Kiro to generate **CloudWatch** monitoring or other monitoring solutions (e.g., Prometheus), and set up basic **Alarms**, such as: **CPU exceeding 70%, or Lambda Error Rate > 3%**.

### Step 5.3 (Optional) Load Testing

Use Kiro to generate load testing scripts and run load tests against the deployed application from the previous step until **an Alarm is triggered**.

### Step 5.4 (Optional) AWS DevOps Agent Automated Operations

Use the **AWS DevOps Agent's** **Incident Response** to perform an **Investigation** ([doc](https://docs.aws.amazon.com/devopsagent/latest/userguide/incident-response-start-investigation.html)) on the Alarm triggered in the previous step.

---

## Additional Examples

### Sample Prompt for End-to-End Testing in Kiro IDE Vibe Mode:

Your role: You are a professional end-to-end (E2E) testing strategist responsible for comprehensively testing a full-stack application. You have access to the playwright MCP server and must use playwright MCP to test the front-end. Your goal is to verify that all system components work seamlessly together: front-end UI, APIs, back-end services, and data models.

Before executing the tasks described below, first create a plan and write your steps in the e2e-testing/e2e_testing_plan.md file, adding a checkbox for each step. If any step requires my clarification, add a question with a [Question] tag and create an empty [Answer] tag for me to fill in. Do not make key decisions on your own. Once you have created the plan, request my review and approval. After I approve, you may execute the plan step by step. After completing each step, mark the corresponding checkbox in the plan as done.

Your task: Analyze the user stories in Requirement.md and complete the following:

* Create and execute a complete end-to-end test suite that validates the entire application workflow, ensuring correct integration across all layers.
* Generate a comprehensive test plan for each layer.
* Document any discrepancies between the implementation and requirements.
* Document all assumptions made during testing.
* Provide recommendations for fixing integration issues.
* Create a plan for fixing identified issues.
* Review the fix plan, fix all identified issues, and update the test plan.
* Make necessary fixes to back-end and front-end code. Track all changes in the plan.
* Test scripts should integrate with playwright MCP using the Strands agent. Use Strands MCP to retrieve information about Strands.
* All output should be placed in the e2e-testing/ folder.

### Sample Prompt for ECS Deployment in Kiro CLI Mode:

Your role: You are an experienced DevOps engineer. Before executing the tasks described below, first create a plan and write your steps in the deploy/ecs/deploy_plan.md file, adding a checkbox for each step. If any step requires my clarification, add a question with a [Question] tag and create an empty [Answer] tag for me to fill in. Do not make key decisions on your own. Once you have created the plan, request my review and approval. After I approve, you may execute the plan step by step. After completing each step, mark the corresponding checkbox in the plan as done.

Task:

* Referring to the Dockerfile in the backend/ folder, deploy the back-end application to an ECS cluster in a private subnet.
* Referring to the Dockerfile in the frontend/ folder, deploy the front-end application to an ECS cluster in a private subnet.
* Use an ALB (Application Load Balancer) in a public subnet to expose the front-end URL.

---

## Reference: Detailed Step-by-Step Prompts Based on Kiro CLI (or Kiro IDE Vibe Mode)

Note: To deepen your understanding of the AIDLC methodology, it is recommended to first experience the manually entered prompts below. For actual engineering projects, you may consider the fully automated workflow from the official Global AIDLC, which can replace the manual input below: https://github.com/awslabs/aidlc-workflows — Corresponding blog: https://aws.amazon.com/cn/blogs/devops/building-with-ai-dlc-using-amazon-q-developer/

### Prompt 1 — User Stories

Your role: You are a professional Product Manager responsible for creating well-defined user stories that will serve as the contract for developing the system described in the Task section below.

Create a plan for the upcoming work and write your steps in the markdown file user_stories/user_stories_plan.md, adding a checkbox for each step in the plan. If any step requires my clarification, add a question with a [Question] tag and create an empty [Answer] tag for me to fill in. Do not make key decisions on your own. Once the plan is complete, request my review and approval. After I approve, you may proceed to execute the same plan step by step. After completing each step, mark the checkbox in the plan as done.

Your task: Create user stories for the high-level requirements described in the Product Description. User stories must be created in the user_stories/ folder.

## Product Description

Build an internal employee benefits e-commerce website called AWSomeShop. The project aims to validate the business model of an employee points redemption system through a Minimum Viable Product (MVP).

## Core Features:

- Employees:
  - Can browse and redeem a small selection of pre-selected products using their "AWSome Points."
  - Can view their points balance and redemption history.
- Administrators:
  - Can manually configure product information.
  - Can manually manage employee "AWSome Points" (issue and deduct).

The MVP will be built as an application that can run in a desktop environment for demonstration purposes.

### Prompt 2 — Work Units

Your role: You are an experienced software architect. Before starting the tasks described below, create a plan and write your steps in the units/units_plan.md file, adding a checkbox for each step in the plan. If any step requires my clarification, add a question with a [Question] tag and create an empty [Answer] tag for me to fill in. Do not make key decisions on your own. Once the plan is created, request my review and approval. After I approve, you may proceed to execute the same plan step by step. After completing each step, mark the checkbox in the plan as done.

Your task: Refer to the user stories in the user_stories/ folder. Group the user stories into multiple units that can be built independently. Each unit contains highly cohesive user stories that can be built by a single team. Units are loosely coupled with each other. For each unit, write their respective user stories and acceptance criteria in a separate markdown file in the /units folder.

### Prompt 3 — Component Model

Your role: You are an experienced software engineer. Before starting the tasks described below, create a plan and write your steps in the component_model/component_model_plan.md file, adding a checkbox for each step in the plan. If any step requires my clarification, add a question with a [Question] tag and create an empty [Answer] tag for me to fill in. Do not make key decisions on your own. Once the plan is created, request my review and approval. After I approve, you may proceed to execute the same plan step by step. After completing each step, mark the checkbox in the plan as done.

Your task: Refer to the user stories for the units in the units/ folder. Design a component model to implement all user stories in the units. The model should contain all components, properties, behaviors, and how components interact to fulfill the user stories. Do not generate any code yet. Write each component in a separate markdown file in the /component_model folder.

### Prompt 4 — Data Model

Your role: You are an experienced database architect. Before starting the tasks described below, create a plan and write your steps in the data_model/data_model_plan.md file, adding a checkbox for each step in the plan. If any step requires my clarification, add a question with a [Question] tag and create an empty [Answer] tag for me to fill in. Do not make key decisions on your own. Once the plan is created, request my review and approval. After I approve, you may proceed to execute the same plan step by step. After completing each step, mark the checkbox in the plan as done.

Task: Refer to the component model in the component_model/ folder. Generate a data model for the database service that will be deployed on a local SQLite instance. Create the output in the data_model/ folder. Also, create a database script init_database.sql in the data_model/ folder to initialize the SQLite instance and create the required schema. Review the data_model/init_database.sql script, create 20 sample user entries with usernames like user1, user2, etc. Set full_name to be the same as the username. Use Finance, Engineering, Marketing, Sales, Design for departments. Use appropriate roles based on the department. Locations can be cities in the United States. Generate a .sql file in the data_model/ folder that can be loaded into SQLite.

### Prompt 5 — Back-End API Server

Your role: You are an experienced software engineer. Before starting the tasks described below, create a plan and write your steps in the backend/backend_code_plan.md file, adding a checkbox for each step in the plan. If any step requires my clarification, add a question with a [Question] tag and create an empty [Answer] tag for me to fill in. Do not make key decisions on your own. Once the plan is created, request my review and approval. After I approve, you may proceed to execute the same plan step by step. After completing each step, mark the checkbox in the plan as done.

Task: Refer to the component design markdown files in the component_model/ folder, the units in the units/ folder, and the data model in the data_model/ folder.

- Generate very simple and intuitive Python FastAPI-based REST APIs for each component.
- Follow best practices for clean, simple, explainable coding.
- Validate that the generated code works and executes as expected by creating a validation plan and generating a validation report.
- Review the validation report, fix all identified issues, and update the validation report.
- Write each component in a separate module.
- Write a wrapper script that can be used to start the application as a server.
- Create a script to run the server in a Python virtual environment.
- All output code goes in the backend/ folder.

Refer to the code in the /backend folder. How are the database settings configured in the code?

### Prompt 6 — User Interface

Your role: You are an experienced user interface developer. Before starting the tasks described below, create a plan and write your steps in the frontend/frontend_code_plan.md file, adding a checkbox for each step in the plan. If any step requires my clarification, add a question with a [Question] tag and create an empty [Answer] tag for me to fill in. Do not make key decisions on your own. Once the plan is created, request my review and approval. After I approve, you may proceed to execute the same plan step by step. After completing each step, mark the checkbox in the plan as done.

Task: Refer to the component design markdown files in the component_model/ folder, the units in the units/ folder, the data model in the data_model/ folder, and the back-end code in the backend/ folder. Complete the following:

- Generate a dynamic responsive web application based on React, Vite, Tailwind CSS, and Shadcn.
- The UI framework is based on the open-source project antd.
- Follow React best practices for clean, simple, explainable coding.
- Validate that the generated code works and executes as expected by creating a validation plan and generating a validation report.
- Review the validation report, fix all identified issues, and update the validation report.
- Write each component in a separate module.
- Write a wrapper script that can be used to start the web application as a server.
- All output code goes in the frontend/ folder.

### Prompt 7 — Testing

Your role: You are a professional end-to-end testing strategist responsible for comprehensively testing a full-stack application. You have access to the playwright MCP server and must use playwright MCP to test the front-end. Your goal is to verify that all system components work seamlessly together: front-end UI, APIs, back-end services, and data models.

Before starting the tasks described below, create a plan and write your steps in the e2e-testing/e2e_testing_plan.md file, adding a checkbox for each step in the plan. If any step requires my clarification, add a question with a [Question] tag and create an empty [Answer] tag for me to fill in. Do not make key decisions on your own. Once the plan is created, request my review and approval. After I approve, you may proceed to execute the same plan step by step. After completing each step, mark the checkbox in the plan as done.

Your task: Analyze the component model in the component_model/ folder, the data model in the data_model/ folder, the back-end code in the backend/ folder, and the front-end code in the frontend/ folder. Complete the following:

- Create and execute a complete end-to-end test suite that validates the entire application workflow, ensuring correct integration across all layers.
- Generate a comprehensive test plan for each layer.
- Document any discrepancies between the implementation and requirements.
- Document all assumptions made during testing.
- Provide recommendations for fixing integration issues.
- Create a plan for fixing identified issues.
- Review the fix plan, fix all identified issues, and update the test plan.
- Make necessary fixes to back-end and front-end code. Track all changes in the plan.
- All output goes in the e2e-testing/ folder.

Analyze e2e-testing/e2e_testing_plan.md, as well as the component model in the component_model/ folder, the data model in the data_model/ folder, the back-end code in the backend/ folder, and the front-end code in the frontend/ folder. Use the Playwright MCP server to run incomplete tests, fix identified issues, and update the test plan. Make necessary fixes to back-end and front-end code. Track all changes in the plan.

### Prompt 8 — Troubleshooting

Analyze the back-end code in the /backend folder and the front-end code in the /frontend folder. Analyze the test records in the /e2e-testing folder. Output errors in the following format to error-repair.md, then fix them one by one. Check whether there are mismatches between back-end and front-end data entities.

Browser errors:
Back-end errors:
Front-end errors:

### Prompt 9 — Build Container Image

Analyze the back-end code in the /backend folder and the front-end code in the /frontend folder, and containerize them along with the relevant files in the /data_model folder into a single container image. The application should serve both the front-end UI and back-end API from a single container.

Requirements:

1. Create a multi-stage Dockerfile that builds the front-end and integrates it with the back-end.
2. Configure FastAPI to serve both API routes (/api/\*) and front-end static files (/\*).
3. Handle React Router SPA routing with proper fallback to index.html.
4. Ensure the container runs on a single port (8000).
5. Maintain existing API functionality while serving the front-end.

Key implementation points:

- Use multi-stage Docker builds (Node.js for front-end build, Python for runtime).
- Configure FastAPI's StaticFiles middleware for front-end serving.
- Set up correct routing priority (API routes before static file routes).
- Handle React Router's SPA routing fallback.
- Include database initialization and sample data.

Expected results:

- Single container accessible at http://localhost:8000
- Front-end UI served at the root path /
- API endpoints accessible at /api/\*
- Production-ready configuration with proper static file handling

Please provide the complete Dockerfile and any necessary configuration changes to the FastAPI main.py file to achieve this setup.

### Prompt 10 — Deploy to AWS Elastic Beanstalk

Deploy my containerized SimpleMart application to AWS Elastic Beanstalk in us-west-2 using t3.small, and provide the final URL.

---

## More Examples

### Prompt 7.1 — Integration

Your role: You are a professional full-stack developer. Pull the latest code and test locally. Please first review frontend/, backend/, deploy/local. Do not update existing code in frontend/ or backend/ — only add new files. Place deployment-related content in deploy/local.

Create a plan and write your steps in the deploy/local/deploy_plan_local.md file, adding a checkbox for each step in the plan. If any step requires my clarification, add a question with a [Question] tag and create an empty [Answer] tag for me to fill in. Do not make key decisions on your own. Once you have created the plan, request my review and approval. After I approve, you may proceed.
