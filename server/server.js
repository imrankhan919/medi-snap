import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    },
});
const upload = multer({ storage: storage });

// Default Route
app.get("/", (req, res) => {
    res.json({
        msg: "WELCOME TO MEDI_SNAP"
    })
})




app.post("/analyze", upload.single("image"), async (req, res) => {
    try {
        const filePath = req.file.path;
        const imageData = fs.readFileSync(filePath).toString("base64");

        const prompt = `
You are a medical assistant. Analyze the medicine wrapper image and extract the available data.

Then, based on the medicine name or visible composition, try to intelligently infer common medical information like its uses, side effects, dosage, etc., even if they are not explicitly written on the image.

Output only clean JSON (no explanation, no markdown).

{
  "medicine_name": "",
  "uses": "",
  "side_effects": "",
  "dosage": "",
  "manufacturer": "",
  "precautions": "",
  "expiry_date": "",
  "composition": ""
}

If any field is not present or inferable, use "Not available".
`;


        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${imageData}`,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 1000,
        });

        const rawResponse = completion.choices[0]?.message?.content || "";

        const cleanJSON = extractJSON(rawResponse);

        res.json({ success: true, data: cleanJSON });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ success: false, message: "Server Error", error });
    }
});

function extractJSON(text) {
    try {
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) return JSON.parse(jsonMatch[1]);

        return JSON.parse(text); // fallback if no code block
    } catch (e) {
        return {
            medicine_name: "Not available",
            uses: "Not available",
            side_effects: "Not available",
            dosage: "Not available",
            manufacturer: "Not available",
            precautions: "Not available",
            expiry_date: "Not available",
            composition: "Not available",
            error: "Invalid response from AI",
        };
    }
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
