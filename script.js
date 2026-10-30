// ⚠️ PASTE YOUR ACTUAL API KEY HERE, keeping the quotes!
const API_KEY = "YOUR_GEMINI_API_KEY_HERE";

// Switched to 1.5-flash-latest which is the most stable free model right now
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${API_KEY}`;
// ---- LIVE PREVIEW BINDING ----
document.getElementById('summaryInput').addEventListener('input', (e) => {
    const preview = document.getElementById('previewSummary');
    preview.innerText = e.target.value || "Your tailored summary will appear here...";
    preview.classList.toggle('italic', !e.target.value);
});

document.getElementById('experienceInput').addEventListener('input', (e) => {
    const lines = e.target.value.split('\n').filter(l => l.trim());
    const ul = document.getElementById('previewExperience');
    ul.innerHTML = lines.length
        ? lines.map(l => `<li>${l}</li>`).join('')
        : "<li>Your tailored bullet points will appear here...</li>";
});

// ---- GEMINI HELPER ----
async function callGemini(prompt) {
    const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    if (!res.ok) {
        const err = await res.json();
        // This will print the exact error from Google
        throw new Error(err.error?.message || "API request failed. Check your API key.");
    }

    const data = await res.json();
    
    if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
        throw new Error("The AI returned an empty response. Try again.");
    }

    return data.candidates[0].content.parts[0].text;
}

// ---- MAGIC WRITE ----
async function magicWrite(type) {
    const jobDesc = document.getElementById('jobDesc').value.trim();
    const currentSummary = document.getElementById('summaryInput').value.trim();
    const currentExp = document.getElementById('experienceInput').value.trim();

    if (!jobDesc) return alert("Please paste a Job Description first.");
    if (!currentSummary && !currentExp) return alert("Please upload a PDF or type your experience first.");

    const btn = event.target;
    btn.disabled = true;
    btn.textContent = "✨ Thinking...";

    try {
        let prompt = "";
        if (type === 'summary') {
            prompt = `
            Job Description: ${jobDesc}
            My Current Resume Text: ${currentSummary} ${currentExp}
            
            Task: Based on my current resume text, write a 3-sentence professional summary tailored to the job description. 
            Return ONLY the summary text.
            `;
        } else {
            prompt = `
            Job Description: ${jobDesc}
            My Current Resume Text: ${currentExp}
            
            Task: Based on my current resume text, rewrite my experience into 3 short, achievement-oriented bullet points tailored to the job description. 
            Each bullet must start with a strong verb. Max 15 words per bullet. Return ONLY the 3 bullets separated by newlines.
            `;
        }

        const output = await callGemini(prompt);

        if (type === 'summary') {
            document.getElementById('summaryInput').value = output.trim();
            document.getElementById('summaryInput').dispatchEvent(new Event('input'));
        } else {
            let cleanOutput = output.trim().replace(/^- /gm, ''); 
            document.getElementById('experienceInput').value = cleanOutput;
            document.getElementById('experienceInput').dispatchEvent(new Event('input'));
        }
    } catch (e) {
        alert("AI Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = type === 'summary' ? "✨ Magic Write" : "✨ Rewrite for Impact";
    }
}

// ---- TAILOR RESUME ----
async function tailorResume() {
    const jobDesc = document.getElementById('jobDesc').value.trim();
    const summary = document.getElementById('summaryInput').value.trim();
    const exp = document.getElementById('experienceInput').value.trim();

    if (!jobDesc) return alert("Paste a Job Description first.");
    if (!summary && !exp) return alert("Please upload a PDF or enter your resume details first.");

    const btnText = document.getElementById('btnText');
    const spinner = document.getElementById('spinner');
    btnText.textContent = "Analyzing...";
    spinner.classList.remove('hidden');

    const prompt = `
You are an expert ATS resume optimizer.

Analyze the resume text against the job description below. Fix any messy PDF formatting.
Return ONLY a JSON object (no markdown, no code fences):

{
  "matchScore": <number 0-100>,
  "optimizedSummary": "<rewritten summary based on my uploaded text, tailored to the job>",
  "optimizedBullets": ["<bullet 1>", "<bullet 2>", "<bullet 3>"]
}

Job Description: ${jobDesc}
My Uploaded Resume Summary: ${summary}
My Uploaded Resume Experience: ${exp}
    `;

    try {
        let raw = await callGemini(prompt);
        
        raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
        const data = JSON.parse(raw);

        const badge = document.getElementById('scoreBadge');
        badge.textContent = `${data.matchScore}%`;
        badge.className = "score-badge " + (data.matchScore >= 70 ? "good" : "warn");

        document.getElementById('summaryInput').value = data.optimizedSummary;
        
        let cleanBullets = data.optimizedBullets.map(b => b.replace(/^[-*]\s*/, '')).join('\n');
        document.getElementById('experienceInput').value = cleanBullets;

        document.getElementById('summaryInput').dispatchEvent(new Event('input'));
        document.getElementById('experienceInput').dispatchEvent(new Event('input'));

    } catch (e) {
        alert("Parsing error: " + e.message);
    } finally {
        btnText.textContent = "🚀 Tailor Resume to Job";
        spinner.classList.add('hidden');
    }
}

// ==========================================
// PDF UPLOAD & PARSING LOGIC
// ==========================================
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

document.getElementById('pdfUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileInput = document.getElementById('pdfUpload');
    const label = fileInput.previousElementSibling;
    const originalText = label.innerHTML;
    label.innerHTML = "⏳ Parsing PDF...";

    try {
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const strings = content.items.map(item => item.str);
            fullText += strings.join(" ") + "\n\n";
        }

        let cleanedText = fullText.replace(/\b\d{2}\/\d{4}\b/g, "").trim();
        cleanedText = cleanedText.replace(/([.!?])\s+/g, "$1\n"); 
        
        const expInput = document.getElementById('experienceInput');
        expInput.value = cleanedText.substring(0, 1500); 
        expInput.dispatchEvent(new Event('input'));

        const summaryInput = document.getElementById('summaryInput');
        if (!summaryInput.value.trim()) {
            let summaryText = cleanedText;
            if (cleanedText.includes("Summary")) {
                summaryText = cleanedText.split("Summary")[1]; 
            }
            summaryInput.value = summaryText.substring(0, 300).trim() + "...";
            summaryInput.dispatchEvent(new Event('input'));
        }

    } catch (error) {
        console.error(error);
        alert("Error reading PDF.");
    } finally {
        label.innerHTML = originalText;
    }
});