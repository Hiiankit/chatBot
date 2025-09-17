const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("redis");
const faiss = require("faiss-node");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Parser = require("rss-parser");
const parser = new Parser();

dotenv.config();

const app = express();
const CORS_ORIGIN = process.env.CORS_ORIGIN;
app.use(CORS_ORIGIN ? cors({ origin: CORS_ORIGIN }) : cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const JINA_API_KEY = process.env.JINA_API_KEY;

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const redisClient = createClient({ url: REDIS_URL });
redisClient.on("error", (err) => console.error("Redis Client Error", err));

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

let faissIndex = null;
let documents = [];
let dim = 0;

async function getJinaEmbeddings(texts) {
  try {
    const res = await axios.post(
      "https://api.jina.ai/v1/embeddings",
      { model: "jina-embeddings-v2-base-en", input: texts },
      { headers: { Authorization: `Bearer ${JINA_API_KEY}` } }
    );
    return res.data.data.map((d) => d.embedding);
  } catch (err) {
    console.error(
      "Jina Embedding Error:",
      err.response?.data || err.message
    );
    throw err;
  }
}

const RSS_URL = "https://rss.nytimes.com/services/xml/rss/nyt/World.xml";

async function fetchArticles() {
  try {
    console.log("📡 Fetching 50 news articles...");
    const feed = await parser.parseURL(RSS_URL);
    return feed.items.slice(0, 50).map((item) => ({
      title: item.title,
      link: item.link,
      content: item.contentSnippet || item.content || "",
    }));
  } catch (err) {
    console.error("RSS fetch failed, using fallback articles:", err.message);
    return [
      { title: "Sample Article 1", content: "This is a fallback article." },
      { title: "Sample Article 2", content: "Another offline article." },
    ];
  }
}

function flattenToArray(vectors) {
  if (!Array.isArray(vectors) || vectors.length === 0) return [];
  const d = vectors[0]?.length ?? 0;
  if (!d) return [];
  const flat = new Array(vectors.length * d);
  let o = 0;
  for (const v of vectors) {
    if (!Array.isArray(v) || v.length !== d) {
      throw new Error("All vectors must have the same dimension");
    }
    for (let i = 0; i < d; i++) flat[o++] = v[i];
  }
  return flat;
}

function addVectorsToFaiss(vectors, batchSize = 64) {
  if (!vectors || vectors.length === 0) return;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const chunk = vectors.slice(i, i + batchSize);
    const flat = flattenToArray(chunk);
    faissIndex.add(flat);
  }
}

async function autoIngestArticles() {
  const articles = await fetchArticles();
  const texts = articles.map((a) => `${a.title}. ${a.content}`);
  const vectors = await getJinaEmbeddings(texts);

  if (!vectors || vectors.length === 0) {
    console.warn("No vectors returned from embeddings; skipping ingest");
    return;
  }

  if (!faissIndex) {
    dim = vectors[0].length;
    if (!dim || !Number.isInteger(dim)) {
      throw new Error("Invalid embedding dimension from provider");
    }
    faissIndex = new faiss.IndexFlatL2(dim);
    console.log(`FAISS index created with dim ${dim}`);
  }

  addVectorsToFaiss(vectors, 64);

  documents.push(...texts);
  console.log(`Indexed ${texts.length} news articles into FAISS`);
}

async function initServices() {
  await redisClient.connect();
  console.log("Connected to Redis");
  console.log("FAISS will initialize with news articles");
}

app.get("/", (req, res) =>
  res.send("RAG Chatbot Backend with FAISS is running")
);

app.get("/key-check", (req, res) => {
  res.json({
    gemini: GEMINI_API_KEY ? "Key Loaded" : "No Gemini Key",
    jina: JINA_API_KEY ? "Key Loaded" : "No Jina Key",
  });
});

app.post("/ingest", async (req, res) => {
  try {
    const { docs } = req.body;
    if (!docs || docs.length === 0) {
      return res.status(400).json({ error: "No documents provided" });
    }

    const vectors = await getJinaEmbeddings(docs);

    if (!faissIndex) {
      dim = vectors[0].length;
      faissIndex = new faiss.IndexFlatL2(dim);
      console.log(`FAISS index created with dim ${dim}`);
    }

    addVectorsToFaiss(vectors, 64);
    documents.push(...docs);

    res.json({ message: `Ingested ${docs.length} documents` });
  } catch (err) {
    console.error("Ingest error:", err);
    res.status(500).json({ error: "Failed to ingest documents" });
  }
});

app.post("/chat", async (req, res) => {
  const { sessionId, query } = req.body;
  if (!sessionId || !query) {
    return res.status(400).json({ error: "sessionId and query are required" });
  }

  try {
    const queryVecs = await getJinaEmbeddings([query]);
    const queryVec = queryVecs[0];

    let context = "";
    if (faissIndex && documents.length > 0) {
      const k = 3;
      const search = faissIndex.search(queryVec, k);
      const indices = search.labels[0] ?? search.labels; // bindings may return [labels] or labels
      const idxArray = Array.isArray(indices) ? indices : [indices];
      context = idxArray
        .filter((i) => i !== -1)
        .map((i) => documents[i])
        .join("\n\n");
    }

    const prompt = context
      ? `Use the following context to answer the question:\n\n${context}\n\nQuestion: ${query}`
      : `Answer the question directly:\n\n${query}. If the ${query} is not related to the ${context}, say "I don't know" or "I don't have information about that" or "I don't have information about that".`;

    const geminiRes = await model.generateContent(prompt);
    const botResponse = geminiRes.response.text();

    const message = { user: query, bot: botResponse };
    await redisClient.rPush(sessionId, JSON.stringify(message));

    res.json({ sessionId, query, response: botResponse });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Failed to generate answer" });
  }
});

app.get("/history/:sessionId", async (req, res) => {
  try {
    const history = await redisClient.lRange(req.params.sessionId, 0, -1);
    res.json({
      sessionId: req.params.sessionId,
      history: history.map((msg) => JSON.parse(msg)),
    });
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

app.delete("/reset/:sessionId", async (req, res) => {
  try {
    await redisClient.del(req.params.sessionId);
    res.json({ message: `Session ${req.params.sessionId} cleared` });
  } catch (err) {
    console.error("Reset error:", err);
    res.status(500).json({ error: "Failed to reset session" });
  }
});

initServices().then(async () => {
  await autoIngestArticles();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
