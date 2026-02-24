require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Fetch the comma-separated keys
const PHYE_KEYS = process.env.PHYE_API_KEYS ? process.env.PHYE_API_KEYS.split(',') : [];
let currentPhyeKeyIndex = 0;

// 2. Round-Robin Key Rotator
function getNextPhyeKey() {
    if (PHYE_KEYS.length === 0) return null;
    const key = PHYE_KEYS[currentPhyeKeyIndex];
    currentPhyeKeyIndex = (currentPhyeKeyIndex + 1) % PHYE_KEYS.length;
    return key;
}

// 🛡️ CORS Config
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.options('*', cors());
app.use(express.json({ limit: '10mb' })); 

app.get('/', (req, res) => {
    res.send("🌌 Phye AI Backend is online!");
});

app.post('/api/phye', async (req, res) => {
    const { text, image, language } = req.body;
    const ACTIVE_KEY = getNextPhyeKey();

    if (!ACTIVE_KEY) return res.status(500).json({ raw: "Server Error: No API Keys configured on Render." });

    try {
        const langInstruction = language === 'hi' 
            ? 'Hinglish (Hindi written STRICTLY in the English alphabet. Example: "Ye ek formula hai". DO NOT use Devanagari script.)' 
            : 'Very simple, easy-to-understand English';
        
        const prompt = `You are an expert Physics Tutor (CBSE 10th to College Level).
        Language to use: ${langInstruction}.
        
        CRITICAL FORMATTING RULES:
        1. "desc" field: EVERY SINGLE mathematical variable, fraction, or equation MUST be wrapped in $ signs (inline) or $$ signs (standalone). 
        2. "math" field: DO NOT use $ signs here. Provide pure LaTeX. If the equation has multiple lines, you MUST wrap it in \\begin{aligned} ... \\end{aligned}.
        3. ASCII Graphs vs Tables: ONLY use \`\`\`text ... \`\`\` blocks for drawing visual Free-Body Diagrams, circuits, or kinematic plots. For standard data, use Markdown tables. 
        4. DOUBLE ESCAPING: You MUST double-escape all LaTeX backslashes (e.g., \\\\frac, \\\\sin, \\\\pi).
        5. SI UNITS: Always include standard SI Units in the final answer.

        CBSE FORMATTING STEPS:
        1. "Given Data & To Find": List all known values with their standard SI symbols.
        2. "Formula Used / Principle": State the physics laws or formulas required.
        3. "Implementation / Calculation": Step-by-step substitution and math calculation.
        4. "Final Answer": State the final numerical answer WITH strict SI Units (e.g., m/s^2, Joules, Newtons).

        Query: ${text || "Solve the physics problem shown in the attached image."}`;

        const payload = { 
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        steps: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    title: { type: "STRING" },
                                    math: { type: "STRING" },
                                    desc: { type: "STRING" }
                                },
                                required: ["title", "math", "desc"]
                            }
                        }
                    },
                    required: ["steps"]
                }
            }
        };

        if (image) payload.contents[0].parts.push({ inline_data: { mime_type: "image/jpeg", data: image } });

        const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${ACTIVE_KEY}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });

        const data = await apiRes.json();
        
        if (data.error && data.error.code === 429) {
            const match = data.error.message.match(/retry in ([\d\.]+)s/i);
            return res.status(429).json({ rate_limit: true, retry_in: match ? Math.ceil(parseFloat(match[1])) : 45, raw: "AI Core cooling down." });
        }

        if (!data.candidates) return res.json({ raw: "AI could not process this request." });

        let rawText = data.candidates[0].content.parts[0].text;

        try {
            const jsonResponse = JSON.parse(rawText);
            return res.json(jsonResponse);
        } catch (e) {
            console.error("JSON Parse Error:", e);
            res.json({ raw: rawText });
        }

    } catch (error) {
        console.error("Phye Server Crash:", error);
        res.status(500).json({ raw: "Internal Server Error during processing." });
    }
});

app.listen(PORT, () => console.log(`🚀 Phye Backend running on port ${PORT} with ${PHYE_KEYS.length} keys active.`));
