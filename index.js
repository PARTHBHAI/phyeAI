require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// 🛡️ Middleware & CORS Config
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.options('*', cors());
app.use(express.json({ limit: '10mb' })); 

// 🟢 Health Check Route (Good for checking if Render is awake)
app.get('/', (req, res) => {
    res.send("🌌 Phye AI (Physics Backend) is Online & Ready!");
});

// 🚀 Phye AI Route
app.post('/api/phye', async (req, res) => {
    const { text, image, language } = req.body;

    if (!GEMINI_KEY) return res.status(500).json({ raw: "Server Error: API Key not configured on Render." });

    try {
        // --- 🛠️ THE FIX: Strict Hinglish Enforcement ---
        const langInstruction = language === 'hi' 
            ? 'Hinglish (Hindi conversational language written STRICTLY and EXCLUSIVELY in the English/Latin alphabet. Example: "Ye ek example hai hinglish ka. Physics bahut aasan hai." ABSOLUTELY DO NOT use the Devanagari script. Use English letters ONLY.)' 
            : 'Very simple, easy-to-understand English';
        
        // Advanced Physics Prompt
        const prompt = `You are an expert Physics Tutor (CBSE 10th to College Level).
        Your goal is to explain physics phenomena, solve complex numericals, and derive equations so simply that any student can understand.
        Language to use: ${langInstruction}.
        
        CRITICAL FORMATTING INSTRUCTIONS (CBSE PATTERN):
        Break the answer into these exact logical steps:
        1. "Given Data & To Find": List all known values with their standard SI symbols.
        2. "Formula Used / Principle": State the physics laws or formulas required.
        3. "Implementation / Calculation": Step-by-step substitution and math calculation. Explain the 'why' behind the math.
        4. "Final Answer": State the final numerical answer WITH strict SI Units (e.g., m/s^2, Joules, Newtons).

        PHYSICS SPECIFIC INSTRUCTIONS:
        - Diagrams & Graphs: If the problem is about Kinematics, Optics, Mechanics (Pulleys/Blocks), or Circuits, YOU MUST provide a text-based ASCII Free-Body Diagram or Graph. Wrap these ASCII drawings inside triple backticks like this: \`\`\`text [Draw diagram here] \`\`\`
        - Math Equations: Put major formulas in the "math" JSON field as raw LaTeX (without $ signs). Use inline $math$ in the description for smaller variables.
        - YouTube Links: Include a relevant YouTube search link using Markdown (e.g., [Watch Concept Video](https://www.youtube.com/results?search_query=topic)).

        JSON STRUCTURE REQUIREMENT:
        {
            "steps": [
                { 
                    "title": "Step Title (e.g., Given, Formula, Calculation, Final Answer)", 
                    "math": "Latex equation without $ signs (leave empty if none)", 
                    "desc": "Detailed explanation in ${langInstruction}. Put Markdown tables or \`\`\`text ASCII diagrams \`\`\` here." 
                }
            ]
        }
        
        Query: ${text || "Solve the physics problem shown in the attached image."}`;

        const payload = { 
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                // Using Gemini's native JSON mode to prevent parsing crashes
                responseMimeType: "application/json"
            }
        };

        if (image) {
            payload.contents[0].parts.push({ inline_data: { mime_type: "image/jpeg", data: image } });
        }

        // We use gemini-2.5-flash as it is highly optimized for JSON Schema enforcement
        const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload)
        });

        const data = await apiRes.json();
        
        // Catch 429 Rate Limits
        if (data.error && data.error.code === 429) {
            const match = data.error.message.match(/retry in ([\d\.]+)s/i);
            return res.status(429).json({ rate_limit: true, retry_in: match ? Math.ceil(parseFloat(match[1])) : 45, raw: "AI Core cooling down." });
        }

        if (!data.candidates) return res.json({ raw: "AI could not process this request." });

        const rawText = data.candidates[0].content.parts[0].text;

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

app.listen(PORT, () => console.log(`🚀 Phye Backend running on port ${PORT}`));
