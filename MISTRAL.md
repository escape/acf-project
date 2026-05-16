# Using ACF with Mistral API

The Adaptive Creative Framework now supports both Anthropic (Claude) and Mistral APIs!

## 🔧 Setup

### 1. Install Mistral SDK

The Mistral SDK is already included in the dependencies, but if you need to install it manually:

```bash
npm install @mistralai/mistralai
```

### 2. Set your Mistral API key

Create a `.env` file in the project root:

```bash
echo "MISTRAL_API_KEY=your_api_key_here" > .env
```

### 3. Configure the LLM provider

Set the `LLM_PROVIDER` environment variable to use Mistral:

```bash
export LLM_PROVIDER=mistral
export MISTRAL_API_KEY=your_api_key_here
```

## 🚀 Usage

### Using Mistral

```bash
LLM_PROVIDER=mistral MISTRAL_API_KEY=your_key_here node dist/index.js new
```

### Using Anthropic (default)

```bash
ANTHROPIC_API_KEY=your_key_here node dist/index.js new
```

## 📊 Model Comparison

| Provider | Model | Context Window | Strengths |
|----------|-------|----------------|-----------|
| **Anthropic** | claude-sonnet-4-20250514 | 200K tokens | Excellent reasoning, structured output |
| **Mistral** | mistral-large-latest | 32K tokens | Fast, cost-effective, creative |

## 🔄 Switching Between Providers

The system automatically detects which provider to use based on the `LLM_PROVIDER` environment variable:

- `LLM_PROVIDER=anthropic` (default) - Uses Claude
- `LLM_PROVIDER=mistral` - Uses Mistral

## 🛠️ Customization

You can customize the Mistral model by editing `src/utils/llm-mistral.ts`:

```typescript
const MODEL = "mistral-large-latest"; // Change to "mistral-small", "mistral-medium", etc.
const TEMPERATURE = 0.7; // Adjust creativity level
```

## 🎯 Benefits of Mistral Integration

1. **Cost-effective alternative** to Anthropic
2. **Fast response times** for iterative creative work
3. **Easy switching** between providers
4. **Same interface** - all existing commands work identically
5. **Future-proof** architecture for adding more providers

## ⚠️ Notes

- Mistral's JSON parsing is slightly different from Claude's, but the system handles both formats
- Some prompts may need minor adjustments for optimal results with Mistral
- Always test with your specific use case before production use