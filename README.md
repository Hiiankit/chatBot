# RAG Chatbot with FAISS, Redis & Google Gemini API

This is a **Retrieval-Augmented Generation (RAG) Chatbot** built using **Node.js**, **Express**, **FAISS**, **Redis**, **Jina embeddings**, and **Google Gemini AI**. The bot fetches news articles, creates embeddings, stores them in a FAISS index, and answers user queries using a combination of context retrieval and generative AI.

---

## Features

- ✅ Fetch latest news articles from RSS feeds
- ✅ Generate embeddings using **Jina API**
- ✅ Store and search embeddings with **FAISS**
- ✅ Context-aware responses with **Google Gemini AI**
- ✅ Session management and chat history stored in **Redis**
- ✅ Frontend with React, session support, and chat interface
- ✅ Multiple chat sessions and session reset

---

## Tech Stack

- **Backend:** Node.js, Express, Axios  
- **Frontend:** React, TypeScript, Tailwind CSS  
- **Database:** Redis (for chat history)  
- **Vector Search:** FAISS (via `faiss-node`)  
- **Embeddings:** Jina AI  
- **Generative AI:** Google Gemini API  

---

## Getting Started

### 1. Clone the repository

# install Dependencies

# Backend
npm install

# Frontend (if separate directory)
npm install


3. Set up environment variables

PORT=5000
GEMINI_API_KEY=your_google_gemini_api_key
JINA_API_KEY=your_jina_api_key
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3000

4. Run Redis
redis-server

5. Start the backend
6. Start the frontend

API Endpoints

| Endpoint              | Method | Description                       |
| --------------------- | ------ | --------------------------------- |
| `/`                   | GET    | Test server status                |
| `/key-check`          | GET    | Check if API keys are loaded      |
| `/ingest`             | POST   | Ingest custom documents           |
| `/chat`               | POST   | Send a query and get bot response |
| `/history/:sessionId` | GET    | Fetch chat history for a session  |
| `/reset/:sessionId`   | DELETE | Reset chat history for a session  |


Acknowledgements

FAISS
Jina AI
Google Generative AI
RSS Parser
React & TailwindCSS

