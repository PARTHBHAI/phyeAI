// ==========================================
// 🌌 NEW: PHYE AI ROUTE (PHYSICS)
// ==========================================
app.post('/api/phye', async (req, res) => {
    const { text, image, language } = req.body;

    if (!GEMINI_KEY) return res.status(500).json({ raw: "Server Error: API Key not configured." });

    try {
        const langInstruction = language === 'hi' 
            ? 'Hinglish (Simple Hindi mixed with English physics terms)' 
            : 'Very simple, easy-to-understand English';
        
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
                responseMimeType: "application/json"
            }
        };

        if (image) {
            payload.contents[0].parts.push({ inline_data: { mime_type: "image/jpeg", data: image } });
        }

        const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload)
        });

        const data = await apiRes.json();
        
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
