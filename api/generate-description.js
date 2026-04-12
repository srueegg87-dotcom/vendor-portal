export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { title, category, imageBase64, mimeType } = req.body;

    const prompt = `Schreibe eine kurze, ansprechende Produktbeschreibung auf Deutsch für ein Secondhand-Inserat auf Rüegg's Familienbörse (Schweiz).

Artikel: ${title}${category ? `\nKategorie: ${category}` : ''}

Max. 3-4 Sätze. Beschreibe Zustand, Eignung und lade freundlich zur Kontaktaufnahme ein. Kein "Ich verkaufe". Direkt und persönlich. Nur die Beschreibung, kein Titel.

Antworte NUR mit der Beschreibung, kein JSON, kein Markdown.`;

    const parts = [];
    if (imageBase64 && mimeType) {
      parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
    }
    parts.push({ text: prompt });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 500 }
        })
      }
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.status(200).json({ description: text.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
