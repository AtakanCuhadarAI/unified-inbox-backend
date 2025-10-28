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

  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // 1) Kullanıcıdan gelen normal mesaj var mı? (inbound)
    // value.messages[0] genelde şöyle olur:
    // {
    //   from: "90507....",
    //   timestamp: "1761673000",
    //   text: { body: "Merhaba" },
    //   type: "text"
    // }
    const incomingMsg = value?.messages?.[0];

    if (incomingMsg) {
      const from = incomingMsg.from;
      const textBody =
        incomingMsg.text?.body ||
        incomingMsg.interactive?.button_reply?.title ||
        "[non-text message]";
      const ts = incomingMsg.timestamp;

      inboxMessages.unshift({
        id: `wa_${Date.now()}`,
        channel: "whatsapp",
        direction: "inbound", // müşteri -> biz
        from,
        text: textBody,
        receivedAt: new Date(Number(ts) * 1000).toISOString(),
        status: "unread"
      });

      console.log("✅ Inbound mesaj inboxMessages içine eklendi.");
    }

    // 2) Gönderdiğimiz mesajların durum güncellemesi var mı? (status update)
    // value.statuses[0] genelde şöyle olur:
    // {
    //   status: "sent" | "delivered" | "read",
    //   timestamp: "...",
    //   recipient_id: "90507..."
    // }
    const statusUpdate = value?.statuses?.[0];

    if (statusUpdate) {
      const to = statusUpdate.recipient_id;
      const deliveryStatus = statusUpdate.status;
      const ts2 = statusUpdate.timestamp;

      inboxMessages.unshift({
        id: `wa_status_${Date.now()}`,
        channel: "whatsapp",
        direction: "outbound-status", // biz -> müşteri durumu
        to,
        text: `Message ${deliveryStatus}`,
        receivedAt: new Date(Number(ts2) * 1000).toISOString(),
        status: deliveryStatus
      });

      console.log("✅ Status update inboxMessages içine eklendi.");
    }
  } catch (err) {
    console.log("⚠️ Parse error:", err.message);
  }

  // WhatsApp "200 OK" bekliyor yoksa tekrar gönderir
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// 4) WhatsApp reply endpoint
// Buraya POST atacağız: { "to": "9050xxxxxxx", "text": "Merhaba, nasıl yardımcı olabilirim?" }
app.post("/reply/whatsapp", async (req, res) => {
  try {
    const { to, text } = req.body;

    if (!to || !text) {
      return res.status(400).json({ error: "to ve text zorunlu" });
    }

    // WhastApp API'ye gidecek veriler
    const payload = {
      messaging_product: "whatsapp",
      to: `+${to.replace(/^\+/, "")}`, // +90... formatını garanti altına al
      type: "text",
      text: {
        preview_url: false,
        body: text
      }
    };

    // Meta bize panelde "Phone number ID" verdi ya, onu kullanıyoruz:
    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      return res
        .status(500)
        .json({ error: "Sunucuda PHONE_NUMBER_ID veya WHATSAPP_TOKEN yok" });
    }

    // WhatsApp Cloud API endpoint:
    const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

    // Node 18+ içinde fetch global olarak var. (Senin Node versiyonun da yeterince yeni.)
    const apiResp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await apiResp.json();
    console.log("📤 WhatsApp send result:", data);

    // Gönderdiğimiz mesajı da inboxMessages listesine ekleyelim ki panelde anında görünsün
    inboxMessages.unshift({
      id: `wa_out_${Date.now()}`,
      channel: "whatsapp",
      direction: "outbound",
      to: payload.to,
      text: text,
      receivedAt: new Date().toISOString(),
      status: "sent(pending-confirm)"
    });

    return res.json({
      ok: true,
      whatsapp_api_response: data
    });
  } catch (err) {
    console.log("❌ reply error:", err);
    res.status(500).json({ error: "send failed", detail: err.message });
  }
});
