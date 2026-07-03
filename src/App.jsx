import { useCallback, useEffect, useRef, useState } from "react";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const CLASSIFICATION_PROMPT = `You are a strict binary image classifier with exactly one job: determine whether the image contains a hotdog (a sausage/frankfurter served in a sliced bun).

Respond with ONLY one of these two exact strings, lowercase, no punctuation, no explanation, nothing else:
hotdog
not hotdog`;

const FAKE_COMPANIES = [
  "FRANK & CO.",
  "WIENER DYNAMICS",
  "BUNSTACK",
  "CONDIMENT CAPITAL",
  "ENCASED MEATS INC.",
  "RELISH VENTURES",
];

const TESTIMONIALS = [
  {
    quote:
      "We were losing upwards of 40 engineering hours a week to manual hotdog identification. Not Hotdog gave us that time back.",
    author: "Head of Frankfurter Operations, BunStack",
  },
  {
    quote:
      "I've personally deployed this across twelve regional offices. Not a single corn dog has been misclassified since rollout.",
    author: "VP, Sausage Infrastructure, Encased Meats Inc.",
  },
  {
    quote:
      "Our Series A term sheet explicitly cited this demo as a driver of the investment.",
    author: "General Partner, Relish Ventures",
  },
];

const PRESS_HEADLINES = [
  "TechCrunch: “Not Hotdog closes $50M Series A led by Relish Ventures”",
  "The Information: “Hotdog Recognition Wars Heat Up as Rivals Emerge”",
  "Sausage Weekly: “Is This The Most Important AI Company of 2009?”",
];

const PRICING_PLANS = [
  {
    plan: "STARTER",
    price: 100,
    features: [
      "Up to 500 detections / mo",
      "Standard accuracy model",
      "Email support",
    ],
  },
  {
    plan: "PROFESSIONAL",
    price: 200,
    popular: true,
    features: [
      "Up to 5,000 detections / mo",
      "99.7% accuracy SLA",
      "Priority support",
    ],
  },
  {
    plan: "ENTERPRISE",
    price: 250,
    features: [
      "Unlimited detections",
      "Dedicated account manager",
      "On-prem deployment option",
    ],
  },
];

const FOOTER_LINKS = [
  "Privacy Policy",
  "Terms of Service",
  "Hotdog Data Processing Addendum",
  "Cookie Policy",
  "Responsible Disclosure",
];

function fileToResizedBase64(file, maxDim = 1024) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image_decode_failed"));
    };
    img.src = objectUrl;
  });
}

async function detectHotdog(file) {
  if (!GEMINI_API_KEY) {
    throw new Error("missing_api_key");
  }

  const { base64, mimeType } = await fileToResizedBase64(file);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: CLASSIFICATION_PROMPT },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 20,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    throw new Error("request_failed");
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const normalized = text.trim().toLowerCase().replace(/[^a-z]/g, "");

  if (normalized.includes("nothotdog") || normalized.startsWith("not")) {
    return "not hotdog";
  }
  if (normalized.includes("hotdog")) {
    return "hotdog";
  }
  throw new Error("ambiguous_response");
}

function DigitCounter({ value }) {
  const digits = String(value).padStart(7, "0").split("");
  return (
    <span className="nh-counter">
      {digits.map((d, i) => (
        <span key={i}>{d}</span>
      ))}
    </span>
  );
}

function PriceCard({ plan, price, features, popular }) {
  return (
    <div className={`nh-price-card ${popular ? "popular" : ""}`}>
      {popular && <div className="nh-price-ribbon">★ MOST POPULAR ★</div>}
      <div className="nh-price-head">
        <div className="nh-price-plan">{plan}</div>
      </div>
      <div className="nh-price-amount">
        ${price}
        <small>/mo after trial</small>
      </div>
      <ul className="nh-price-features">
        {features.map((f) => (
          <li key={f}>&#10003; {f}</li>
        ))}
      </ul>
      <div className="nh-price-cta">
        <a href="#detector" className="nh-btn nh-btn-primary">
          Start Free Trial &raquo;
        </a>
      </div>
    </div>
  );
}

function VerdictDialog({ result, onClose, onReset }) {
  const isHotdog = result === "hotdog";
  const cls = isHotdog ? "hot" : "not";
  return (
    <div className="nh-modal-backdrop" role="alertdialog">
      <div className="nh-dialog">
        <div className={`nh-dialog-title ${cls}`}>
          <span>
            {isHotdog ? "ANALYSIS COMPLETE — SUCCESS" : "ANALYSIS COMPLETE — ALERT"}
          </span>
          <span className="x" onClick={onClose} title="Close">
            ✕
          </span>
        </div>
        <div className="nh-dialog-body">
          <div className={`nh-dialog-icon ${cls}`}>{isHotdog ? "✔" : "✖"}</div>
          <div className={`nh-dialog-verdict ${cls}`}>
            {isHotdog ? "HOTDOG" : "NOT HOTDOG"}
          </div>
          <div className="nh-dialog-sub">
            Confidence: {isHotdog ? "99.7%" : "99.4%"} &middot; Verdict is final
          </div>
          <hr className="nh-dialog-rule" />
          <button
            className={`nh-btn ${isHotdog ? "nh-btn-green" : "nh-btn-maroon"}`}
            onClick={onReset}
          >
            Analyze Another &raquo;
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [count, setCount] = useState(() =>
    Math.floor(824_413 + Math.random() * 400_000)
  );
  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => c + Math.floor(Math.random() * 6) + 1);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [result, setResult] = useState(null); // 'hotdog' | 'not hotdog' | null
  const [errorMessage, setErrorMessage] = useState("");
  const [dialogDismissed, setDialogDismissed] = useState(false);
  const [showCoachmark, setShowCoachmark] = useState(true);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const loadFile = useCallback((selected) => {
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setStatus("idle");
    setResult(null);
    setErrorMessage("");
    setDialogDismissed(false);
  }, []);

  const handleInputChange = (e) => {
    loadFile(e.target.files?.[0] ?? null);
    e.target.value = "";
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setStatus("loading");
    setErrorMessage("");
    setDialogDismissed(false);
    try {
      const verdict = await detectHotdog(file);
      setResult(verdict);
      setStatus("idle");
    } catch (err) {
      const message =
        err.message === "missing_api_key"
          ? "Gemini API key is not configured."
          : "Couldn't analyze, try again.";
      setErrorMessage(message);
      setStatus("error");
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setStatus("idle");
    setResult(null);
    setErrorMessage("");
    setDialogDismissed(false);
  };

  let title = "Awaiting Photo Upload";
  let titleClass = "";
  let desc = "Upload a photo or use your camera to begin live hotdog analysis.";

  if (status === "error") {
    title = "Analysis Failed";
    titleClass = "error";
    desc = errorMessage;
  } else if (status === "loading") {
    title = "Evaluating...";
    desc = "Our neural architecture is evaluating pixel-level frankfurter probability.";
  } else if (result === "hotdog") {
    title = "HOTDOG CONFIRMED";
    titleClass = "hot";
    desc = "Confidence: 99.7%. Classified as a hotdog by the NotHotdog Detection Engine v4.2.";
  } else if (result === "not hotdog") {
    title = "NOT A HOTDOG";
    titleClass = "not";
    desc = "Confidence: 99.4%. This image does not contain a hotdog.";
  } else if (file) {
    title = "Ready to Analyze";
    desc = "Photo loaded. Click Analyze to run the detection model.";
  }

  return (
    <div className="nh-page">
      <div className="nh-banner" id="home">
        <div className="nh-logo">
          Not<span>Hotdog</span>.com
        </div>
        <div className="nh-tagline">
          The World's Most Advanced Hotdog Recognition Engine &mdash; powered
          by a proprietary multi-layer neural architecture trained on over 40
          million labeled hotdog images.
        </div>
        <div className="nh-counter-wrap">
          Hotdogs detected today: <DigitCounter value={count} />
        </div>
      </div>

      {showCoachmark && (
        <div className="nh-coachmark">
          <span>
            &#128075; Yes, we know. Jian Yang did it first. We just have
            better UI.
          </span>
          <button
            className="nh-coachmark-close"
            onClick={() => setShowCoachmark(false)}
          >
            Got it &#10005;
          </button>
        </div>
      )}

      <div className="nh-ticker">
        <marquee behavior="scroll" direction="left" scrollamount="4">
          &#127881; Start your 7-day free trial today &mdash; no credit card
          required &mdash; See Pricing below
        </marquee>
      </div>

      <ul className="nh-navtabs">
        <li>
          <a href="#home">Home</a>
        </li>
        <li>
          <a href="#detector">Detector</a>
        </li>
        <li>
          <a href="#pricing">Pricing</a>
        </li>
        <li>
          <a href="#trusted-by">Trusted By</a>
        </li>
        <li>
          <a href="#news">News</a>
        </li>
      </ul>

      <div className="nh-main">
        <div className="nh-panel">
          <div className="nh-panel-head">WELCOME TO NOTHOTDOG.COM</div>
          <div className="nh-panel-body">
            Not Hotdog is the only computer vision platform purpose-built to
            answer a single question &mdash; with zero scope creep, zero
            feature bloat, and maximum focus.
            <div className="nh-statstrip">
              <span className="nh-statchip">★ 99.7% Accuracy</span>
              <span className="nh-statchip">★ Sub-200ms Detection</span>
              <span className="nh-statchip">★ Enterprise-Ready API</span>
            </div>
          </div>
        </div>

        <div className="nh-panel" id="detector">
          <div className="nh-panel-head">LIVE DETECTOR</div>
          <div className="nh-panel-body">
            <div className="nh-detector-stage">
              {previewUrl ? (
                <img src={previewUrl} alt="Uploaded preview" />
              ) : (
                <div className="nh-detector-placeholder">
                  <div className="icon">&#128247;</div>
                  <div>
                    Upload a photo or use your camera to begin live hotdog
                    analysis.
                  </div>
                </div>
              )}

              {status === "loading" && (
                <div className="nh-eval-overlay">
                  <div className="nh-eval-text">EVALUATING...</div>
                  <div className="nh-progress-track">
                    <div className="nh-progress-bar" />
                  </div>
                  <div className="nh-eval-sub">
                    Analyzing pixel-level frankfurter probability&hellip;
                  </div>
                </div>
              )}

              {result === "hotdog" && (
                <div className="nh-detector-badge yes">&#10003;</div>
              )}
              {result === "not hotdog" && (
                <div className="nh-detector-badge no">&#10007;</div>
              )}
            </div>

            <div className="nh-detector-status">
              <div className={`nh-detector-title ${titleClass}`}>{title}</div>
              <div className="nh-detector-desc">{desc}</div>

              <div className="nh-detector-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleInputChange}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={handleInputChange}
                />
                <button
                  className="nh-btn nh-btn-lg"
                  disabled={status === "loading"}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Photo
                </button>
                <button
                  className="nh-btn nh-btn-lg"
                  disabled={status === "loading"}
                  onClick={() => cameraInputRef.current?.click()}
                >
                  Use Camera
                </button>
                <button
                  className="nh-btn nh-btn-primary nh-btn-lg"
                  disabled={!file || status === "loading"}
                  onClick={handleAnalyze}
                >
                  {status === "loading" ? "Evaluating..." : "Analyze »"}
                </button>
                {file && status !== "loading" && (
                  <button className="nh-btn nh-btn-lg" onClick={handleReset}>
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div id="pricing">
          <div className="nh-trial-banner">
            &#127881; Start with a 7-Day Free Trial &mdash; No credit card
            required
          </div>
          <div className="nh-pricing-grid">
            {PRICING_PLANS.map((p) => (
              <PriceCard key={p.plan} {...p} />
            ))}
          </div>
        </div>

        <div className="nh-panel" id="trusted-by" style={{ marginTop: 14 }}>
          <div className="nh-panel-head">TRUSTED BY</div>
          <div className="nh-panel-body">
            <div className="nh-trustedstrip">
              {FAKE_COMPANIES.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="nh-twocol">
          <div className="nh-panel">
            <div className="nh-panel-head">TESTIMONIALS</div>
            <div>
              {TESTIMONIALS.map((t) => (
                <div className="nh-quote" key={t.author}>
                  <div className="nh-quote-text">&ldquo;{t.quote}&rdquo;</div>
                  <div className="nh-quote-author">{t.author}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="nh-panel" id="news">
            <div className="nh-panel-head">IN THE PRESS</div>
            <ul className="nh-linklist">
              {PRESS_HEADLINES.map((h) => (
                <li key={h}>
                  <a href="#" onClick={(e) => e.preventDefault()}>
                    {h}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="nh-footer">
        <div>
          {FOOTER_LINKS.map((link, i) => (
            <span key={link}>
              <a href="#" onClick={(e) => e.preventDefault()}>
                {link}
              </a>
              {i < FOOTER_LINKS.length - 1 ? " | " : ""}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 6 }}>
          &copy; 2026 Not Hotdog, Inc. All rights reserved. Not affiliated
          with any actual hotdog.
        </div>
        <div className="nh-disclaimer">
          Not affiliated with Pied Piper, but we wish we were.
        </div>
        <div className="nh-disclaimer">
          Best viewed in Internet Explorer 6 at 800&times;600 resolution.
        </div>
      </div>

      {result && !dialogDismissed && (
        <VerdictDialog
          result={result}
          onClose={() => setDialogDismissed(true)}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
