
});
const express = require('express');
const Groq = require('groq-sdk');
const gTTS = require('gtts');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(express.json());
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
app.use(express.static('public'));

// This endpoint receives your voice from the ESP32
app.post('/api/voice', upload.single('audio'), async (req, res) => {
    try {
        // 1. Convert your voice to text
        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(req.file.path),
            model: "whisper-large-v3",
        });

        // 2. Ask the AI for a safety tip
        const chat = await groq.chat.completions.create({
            messages: [{ role: "system", content: "You are an airside safety assistant. Give a 1-sentence answer." },
                       { role: "user", content: transcription.text }],
            model: "llama3-8b-8192",
        });

        const replyText = chat.choices[0].message.content;

        // 3. Turn the AI's answer into an MP3
        const gtts = new gTTS(replyText, 'en');
        const fileName = `reply.mp3`; 
        const filePath = path.join(publicDir, fileName);

        gtts.save(filePath, (err) => {
            if (err) return res.status(500).send("TTS Error");
            fs.unlinkSync(req.file.path); // Delete the temp upload
            res.json({ audioUrl: `https://${req.get('host')}/${fileName}` });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Add this at the top with your other routes
app.get('/', (req, res) => {
    res.send('Apron Assistant Brain is Online and Ready!');
});
