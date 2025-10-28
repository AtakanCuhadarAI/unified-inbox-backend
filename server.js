import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "5mb" }));

// sağlık kontrolü
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// unified inbox gibi düşüneceğimiz sahte mesaj listesi
app.get("/messages", (req, res) => {
  const demoMessages = [
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

  res.json(demoMessages);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
