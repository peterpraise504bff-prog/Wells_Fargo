const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;

const codes = new Map();

app.get("/", (req, res) => {
  res.send("Email verification server is running.");
});

app.post("/api/send-code", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address."
      });
    }

    const code = crypto.randomInt(100000, 1000000).toString();

    codes.set(email.toLowerCase(), {
      code,
      expires: Date.now() + 10 * 60 * 1000
    });

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [email],
        subject: "Your Test App Verification Code",
        html: `
          <div style="font-family:Arial,sans-serif;padding:24px">
            <h2>Email Verification</h2>
            <p>You requested a verification code for your test application.</p>
            <div style="font-size:32px;font-weight:bold;letter-spacing:8px">
              ${code}
            </div>
            <p>This code expires in 10 minutes.</p>
            <p>If you didn't request this code, you can ignore this email.</p>
            <hr>
            <p style="color:#777;font-size:12px">
              Test application email. This is not a bank security notification.
            </p>
          </div>
        `
      })
    });

    const result = await response.json();

    if (!response.ok) {
      codes.delete(email.toLowerCase());

      return res.status(500).json({
        success: false,
        message: result.message || "Email could not be sent."
      });
    }

    res.json({
      success: true,
      message: "Verification code sent to your email."
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Email service error."
    });
  }
});

app.post("/api/verify-code", (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({
      success: false,
      message: "Email and verification code are required."
    });
  }

  const record = codes.get(email.toLowerCase());

  if (!record) {
    return res.status(400).json({
      success: false,
      message: "No active verification code found."
    });
  }

  if (Date.now() > record.expires) {
    codes.delete(email.toLowerCase());

    return res.status(400).json({
      success: false,
      message: "Verification code expired. Request another."
    });
  }

  if (record.code !== String(code).trim()) {
    return res.status(400).json({
      success: false,
      message: "Incorrect verification code."
    });
  }

  codes.delete(email.toLowerCase());

  res.json({
    success: true,
    message: "Email successfully verified."
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
