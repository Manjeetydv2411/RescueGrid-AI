"""AI Service for RescueGrid AI

This Python FastAPI service provides AI-assisted incident intelligence for the
RescueGrid AI emergency response platform.

## Features

- **Category Suggestion**: Suggest incident categories from textual descriptions using keyword matching
- **Summary Generation**: Produce structured incident summaries with key points and impact estimates
- **Priority Scoring**: Recommend priority scores (0-10) with contributing factors
- **Missing Information Detection**: Flag incomplete information needing verification

## Design Principles

1. **Baseline First**: Transparent, rule-based implementation without external API dependencies
2. **Provider Interface**: AI providers are replaceable via abstract base class
3. **Human Review Mandatory**: AI suggestions are recommendations only; human confirmation required for consequential actions
4. **Strict Validation**: All request/response schemas strictly validated with Pydantic
5. **Versioned Contracts**: Requests and responses include version for future compatibility
6. **No Overclaimed Confidence**: Confidence scores only when meaningful basis exists

## Setup

```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

## Running

```bash
# Development mode with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers 4
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_SERVICE_HOST` | Server host | `0.0.0.0` |
| `AI_SERVICE_PORT` | Server port | `8001` |
| `AI_SERVICE_AI_PROVIDER` | AI provider (baseline only) | `baseline` |
| `AI_SERVICE_LOG_LEVEL` | Log level | `INFO` |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health/live` | GET | Liveness probe |
| `/health/ready` | GET | Readiness probe |
| `/ai/health` | GET | AI service health |
| `/v1/category-suggestion` | POST | Suggest incident category |
| `/v1/summary` | POST | Generate incident summary |
| `/v1/priority-score` | POST | Score priority (0-10) |
| `/v1/missing-info` | POST | Flag missing information |

## Testing

```bash
pytest tests/
```

## Model Limitations

This baseline implementation uses keyword matching and simple rules. It does not:

- Require machine learning training
- Use external API credits
- Claim real-world predictive accuracy
- Provide probabilistic forecasts

For production deployment, consider:
- Evaluating against historical incident data
- Adding bias detection and mitigation
- Implementing human-in-the-loop review workflows
- Logging all recommendations for audit trails

## Replacing the Baseline

To add a new AI provider:

1. Create a new class extending `AIProvider`
2. Implement all abstract methods
3. Register in `app/main.py` by adding provider option to config