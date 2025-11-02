# AI Football Referee Chat

Interactive AI-powered chat that acts as a football referee assistant. Users can ask about in-game situations, football rules, and hypothetical league scenarios. The AI strictly responds to football-related questions, providing accurate referee-style guidance.

## Features

- ⚽ **AI Football Referee Assistant**  
  Responds as a referee for football match situations and rule clarifications.  
  Strictly prohibits answering non-football questions.  

- 💬 Interactive chat interface with message streaming  
- 🗂️ Durable Object-based per-user chat history  
- 🌓 Dark/Light theme support  
- ⚡ Real-time AI streaming responses  
- 🎨 Modern, responsive UI  
- 🔄 State management with AI context window (recent messages)  

## Prerequisites

- Node.js >= 18  
- npm >= 9
- Cloudflare account  
- Cloudflare Workers environment  
- Llama AI model access via Cloudflare AI binding  

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Run locally:

```bash
npm start
```

3. Deploy:

```bash
npm run deploy
```

## Project Structure

```
├── src/
│   ├── app.tsx        # Chat UI implementation
│   ├── server.ts      # Chat agent logic
│   ├── tools.ts       # Tool definitions
│   ├── utils.ts       # Helper functions
│   └── styles.css     # UI styling
```

## Usage

- Ask in-game questions: e.g., “What happens if the ball crosses the goal line?”
- Ask about football terms: e.g., "What is offside?”
- Hypothetical football scenarios: e.g., “If Arsenal wins the Premier League, can they play in the Champions League next season?”

## License

MIT
