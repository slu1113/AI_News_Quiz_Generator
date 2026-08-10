module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "這個功能只接受產生考題的請求。" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ message: "找不到 Gemini API 金鑰，請確認 .env.local 或 Vercel 環境變數已設定。" });
  }

  const { source = "未填寫出處", news = "", type = "單選題", count = 5, level = "普通" } = req.body || {};
  if (!news.trim()) {
    return res.status(400).json({ message: "請先貼上新聞內容。" });
  }

  const prompt = `
你是台灣高中職老師的時事命題助手。請只回傳 JSON，不要加 JSON 以外的文字。
規則：
1. 把新聞改寫成自足的情境題幹，不逐字照抄原文。
2. 單選題固定四個選項，且只有一個明確答案。
3. 每題都要有詳解與出處提醒。
4. 題目全部標示為草稿，提醒老師查核。
5. 使用繁體中文與台灣用語。

出題規格：
- 題型：${type}
- 題數：${Number(count) || 5}
- 難易度：${level}
- 出處：${source}

新聞素材：
${news}

請回傳這個格式：
{
  "questions": [
    {
      "question": "題幹",
      "options": ["選項A", "選項B", "選項C", "選項D"],
      "answer": "A",
      "explanation": "詳解",
      "source": "媒體名稱＋日期"
    }
  ]
}
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    const data = await response.json();

    if (!response.ok) {
      const googleMessage = data.error?.message || "Gemini 產生考題失敗。";
      if (googleMessage.includes("denied access")) {
        return res.status(500).json({
          message: "Google 已收到金鑰，但拒絕這個專案使用 Gemini。請到 Google AI Studio 建立新專案與新金鑰後再試。"
        });
      }
      return res.status(500).json({ message: googleMessage });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(text || "{}");
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    if (!questions.length) {
      return res.status(500).json({ message: "Gemini 沒有回傳可用的題目。" });
    }

    return res.status(200).json({ questions });
  } catch (error) {
    return res.status(500).json({ message: error.message || "產生考題時發生未知錯誤。" });
  }
};
