import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "5mb" }));

// 1) Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// 2) Demo unified inbox messages (şu an sahte data)
let inboxMessages = [
  {
    id: "msg_1",
    channel: "whatsapp",
    from: "+905551112233",
    text: "Merhaba, kargom nerede?",
    receivedAt: "2025-10-28T15:00:00Z",
    status: "unread"
  },
  {
    id: "msg_2",
    channel: "instagram",
    from: "insta_user_44",
    text: "Bu ürünün bedeni S var mı?",
    receivedAt: "2025-10-28T15:02:13Z",
    status: "unread"
  },
  {
    id: "msg_3",
    channel: "facebook",
    from: "fb_user_91",
    text: "Fiyat nedir?",
    receivedAt: "2025-10-28T15:05:40Z",
    status: "read"
  }
];

app.get("/messages", (req, res) => {
  res.json(inboxMessages);
});

// 3) WhatsApp Webhook Verify + Receive
const VERIFY_TOKEN = "unifiedinboxtest"; // Bunu Meta tarafına gireceğiz

// Meta ilk doğrulamada buraya GET ile gelir
app.get("/webhook/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified!");
    res.status(200).send(challenge);
  } else {
    console.log("❌ Webhook verify failed. token:", token);
    res.sendStatus(403);
  }
});

// Meta gerçek mesajları buraya POST eder
app.post("/webhook/whatsapp", (req, res) => {
  console.log("📩 Incoming WhatsApp payload:");
  console.dir(req.body, { depth: null });

  // Basit ekleme: gelen mesajı inboxMessages listesine push edebiliriz
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const msg = change?.value?.messages?.[0];

    if (msg) {
      const from = msg.from;           // gönderen numara
      const text = msg.text?.body;     // mesaj içeriği
      const ts = msg.timestamp;        // zaman

      inboxMessages.unshift({
        id: `wa_${Date.now()}`,
        channel: "whatsapp",
        from,
        text,
        receivedAt: new Date(Number(ts) * 1000).toISOString(),
        status: "unread"
      });

      console.log("✅ Mesaj inboxMessages içine eklendi.");
    } else {
      console.log("ℹ️ Mesaj objesi bulunamadı (muhtemelen status update).");
    }
  } catch (err) {
    console.log("⚠️ Parse error:", err.message);
  }

  // WhatsApp'a 'aldım' dememiz gerekiyor yoksa tekrar gönderir
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
