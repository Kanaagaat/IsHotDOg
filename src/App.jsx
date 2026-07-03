import { useCallback, useEffect, useRef, useState } from "react";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const CLASSIFICATION_PROMPT = `You are a strict binary image classifier with exactly one job: determine whether the image contains a hotdog (a sausage/frankfurter served in a sliced bun).

Respond with ONLY one of these two exact strings, lowercase, no punctuation, no explanation, nothing else:
hotdog
not hotdog`;

const FAKE_COMPANIES = [
  { mono: "F&", name: "FRANK & CO.", desc: "Enterprise frankfurter logistics" },
  { mono: "WD", name: "WIENER DYNAMICS", desc: "Industrial sausage robotics" },
  { mono: "BS", name: "BUNSTACK", desc: "Cloud-native bun infrastructure" },
  { mono: "CC", name: "CONDIMENT CAPITAL", desc: "Series B mustard fund" },
  { mono: "EM", name: "ENCASED MEATS INC.", desc: "Vertically integrated casings" },
  { mono: "RV", name: "RELISH VENTURES", desc: "Seed-stage relish accelerator" },
];

const FEATURES = [
  {
    title: "99.7% Accuracy",
    desc: "Benchmarked against our proprietary, internally-curated hotdog corpus. Independently unverified.",
  },
  {
    title: "Sub-200ms Detection",
    desc: "Engineered from the ground up to answer one question as fast as physically possible.",
  },
  {
    title: "Enterprise-Ready API",
    desc: "SOC 2-track, SSO-pending, on-prem-curious. Ask our sales team about our roadmap.",
  },
];

const PRESS_HEADLINES = [
  "TechCrunch: “Not Hotdog closes $50M Series A led by Relish Ventures”",
  "The Information: “Hotdog Recognition Wars Heat Up as Rivals Emerge”",
  "Sausage Weekly: “Is This The Most Important AI Company of 2009?”",
];

const FEED = [
  {
    mono: "HF",
    title: "“Definitely a hotdog” — confirmed via BunStack",
    quote:
      "We were losing upwards of 40 engineering hours a week to manual hotdog identification. Not Hotdog gave us that time back — and, frankly, our sense of purpose.",
    author: "Head of Frankfurter Operations, BunStack",
    meta: "Posted 2 hours ago · Verified detection",
  },
  {
    mono: "VS",
    title: "“Not a single corn dog since rollout” — Encased Meats Inc.",
    quote:
      "I've personally deployed this across twelve regional offices. Not a single corn dog has been misclassified since rollout.",
    author: "VP, Sausage Infrastructure, Encased Meats Inc.",
    meta: "Posted 5 hours ago · Verified detection",
  },
  {
    mono: "GP",
    title: "“Cited in our term sheet” — Relish Ventures",
    quote:
      "Our Series A term sheet explicitly cited this demo. I am not exaggerating when I say this product changed the trajectory of the fund.",
    author: "General Partner, Relish Ventures",
    meta: "Posted 1 day ago · Verified detection",
  },
];

const FOOTER_LINKS = [
  "Privacy Policy",
  "Terms of Service",
  "Hotdog Data Processing Addendum",
  "Cookie Policy",
  "Responsible Disclosure",
  "Series A Press Release",
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

function alertComingSoon(e) {
  e.preventDefault();
  window.alert("Coming soon in v2.0!");
}

function alertInvestorsOnly(e) {
  e.preventDefault();
  window.alert("Investor access is by invitation only.");
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

function SpinnerRing() {
  const count = 8;
  return (
    <div className="nh-spinner-ring">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        const x = 50 + 40 * Math.cos(angle);
        const y = 50 + 40 * Math.sin(angle);
        return (
          <i
            key={i}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%, -50%)",
              animationDelay: `${(i / count) * 1.1}s`,
            }}
          />
        );
      })}
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
          <span>{isHotdog ? "ANALYSIS COMPLETE — SUCCESS" : "ANALYSIS COMPLETE — ALERT"}</span>
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
          <button className="nh-btn nh-btn-green" onClick={onReset}>
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

  let rowTitle = "Awaiting Photo Upload";
  let rowTitleClass = "";
  let rowDesc =
    "Upload a photo or use your camera to begin live hotdog analysis.";

  if (status === "error") {
    rowTitle = "Analysis Failed";
    rowDesc = errorMessage;
  } else if (status === "loading") {
    rowTitle = "Evaluating...";
    rowDesc =
      "Our neural architecture is evaluating pixel-level frankfurter probability.";
  } else if (result === "hotdog") {
    rowTitle = "HOTDOG CONFIRMED";
    rowTitleClass = "hot";
    rowDesc =
      "Confidence: 99.7%. Classified as a hotdog by the NotHotdog Detection Engine v4.2.";
  } else if (result === "not hotdog") {
    rowTitle = "NOT A HOTDOG";
    rowTitleClass = "not";
    rowDesc = "Confidence: 99.4%. This image does not contain a hotdog.";
  } else if (file) {
    rowTitle = "Ready to Analyze";
    rowDesc = "Photo loaded. Click Analyze to run the detection model.";
  }

  return (
    <div className="nh-page">
      <div className="nh-utilitybar">
        <a href="#home">Home</a>
        <a href="#" onClick={alertComingSoon}>
          My Account
        </a>
        <a href="#" onClick={alertComingSoon}>
          Help
        </a>
      </div>

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

        <div className="nh-loginbox">
          <table>
            <tbody>
              <tr>
                <td>Username:</td>
                <td>
                  <input type="text" disabled />
                </td>
              </tr>
              <tr>
                <td>Password:</td>
                <td>
                  <input type="password" disabled />
                </td>
              </tr>
            </tbody>
          </table>
          <div className="nh-loginlinks">
            <a href="#" onClick={alertInvestorsOnly}>
              LOG IN
            </a>{" "}
            |{" "}
            <a href="#" onClick={(e) => e.preventDefault()}>
              REGISTER
            </a>{" "}
            |{" "}
            <a href="#" onClick={(e) => e.preventDefault()}>
              FORGOT
            </a>
          </div>
        </div>
      </div>

      <div className="nh-ticker">
        <marquee behavior="scroll" direction="left" scrollamount="4">
          &#127881; We just closed a $50M Series A to double down on hotdog
          recognition &mdash;{" "}
          <a href="#" onClick={(e) => e.preventDefault()}>
            Read the Press Release
          </a>{" "}
          &nbsp;&nbsp;&nbsp;&nbsp; &#127881; Now hiring: Senior Frankfurter
          Scientist &nbsp;&nbsp;&nbsp;&nbsp; &#127881; As seen in TechCrunch,
          The Information, and Sausage Weekly
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
          <a href="#features">Features</a>
        </li>
        <li>
          <a href="#trusted-by">Trusted By</a>
        </li>
        <li>
          <a href="#testimonials">Testimonials</a>
        </li>
        <li>
          <a href="#pricing">Pricing</a>
        </li>
        <li>
          <a href="#press">Press</a>
        </li>
      </ul>

      <div className="nh-quickbar">
        <span className="nh-quickbar-label">QUICK ANALYZE:</span>
        <span className="nh-fakeinput">
          {file ? file.name : "No file selected..."}
        </span>
        <a href="#detector" className="nh-btn">
          Go to Detector &raquo;
        </a>
      </div>

      <div className="nh-columns">
        <div className="nh-sidebar-left">
          <button
            className="nh-btn nh-btn-dark"
            onClick={() => fileInputRef.current?.click()}
          >
            &#9650; Upload User Photos
          </button>

          <div style={{ height: 10 }} />

          <div className="nh-panel">
            <div className="nh-panel-head">SECTIONS</div>
            <ul className="nh-linklist">
              <li>
                <a href="#home">Overview</a>
              </li>
              <li>
                <a href="#detector">Live Detector</a>
              </li>
              <li>
                <a href="#features">Features</a>
              </li>
              <li>
                <a href="#trusted-by">Trusted By</a>
              </li>
              <li>
                <a href="#testimonials">Testimonials</a>
              </li>
              <li>
                <a href="#pricing">Pricing</a>
              </li>
              <li>
                <a href="#press">Press</a>
              </li>
            </ul>
          </div>

          <div className="nh-panel" id="trusted-by">
            <div className="nh-panel-head">TRUSTED BY</div>
            <div>
              {FAKE_COMPANIES.map((c) => (
                <div className="nh-channelbox" key={c.name}>
                  <div className="nh-channel-logo">{c.mono}</div>
                  <div>
                    <div className="nh-channel-name">{c.name}</div>
                    <div className="nh-channel-desc">{c.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="nh-panel" id="pricing">
            <div className="nh-panel-head">PRICING</div>
            <div className="nh-panel-body">
              Enterprise pricing available upon request.
              <br />
              <br />
              <button
                className="nh-btn"
                onClick={(e) => {
                  e.preventDefault();
                  window.alert(
                    "Our sales team will reach out within 3-5 business quarters."
                  );
                }}
              >
                Contact Sales
              </button>
            </div>
          </div>
        </div>

        <div className="nh-main">
          <div style={{ fontSize: 10, color: "#8896a6", marginBottom: 6 }}>
            Home &raquo; Live Detector
          </div>

          <div className="nh-panel">
            <div className="nh-panel-head">WELCOME TO NOTHOTDOG.COM</div>
            <div className="nh-panel-body">
              Not Hotdog is the only computer vision platform purpose-built
              to answer a single question &mdash; with zero scope creep,
              zero feature bloat, and maximum focus. Upload a photo below
              and our model will render a definitive verdict.
            </div>
          </div>

          <div className="nh-tabbar" id="detector">
            <a href="#detector" className="active">
              Live Detector
            </a>
            <a href="#features">Feature Spotlight</a>
            <a href="#press">Press Coverage</a>
          </div>
          <div className="nh-metabar">
            <span>
              Showing <b>1 of 1</b> detections today &middot; Accuracy:{" "}
              <b>99.7%</b> &middot; Latency: <b>&lt;200ms</b>
            </span>
            <span>&laquo; Previous | 1 | Next &raquo;</span>
          </div>

          <div className="nh-list">
            <div className="nh-row nh-row-live">
              <div className="nh-thumb">
                {previewUrl ? (
                  <img src={previewUrl} alt="Uploaded preview" />
                ) : (
                  <div className="nh-thumb-placeholder">&#128247;</div>
                )}
                {status === "loading" && (
                  <div className="nh-thumb-loading">
                    <SpinnerRing />
                  </div>
                )}
                {result === "hotdog" && (
                  <div className="nh-thumb-badge yes">&#10003;</div>
                )}
                {result === "not hotdog" && (
                  <div className="nh-thumb-badge no">&#10007;</div>
                )}
              </div>
              <div className="nh-row-body">
                <div className={`nh-row-title ${rowTitleClass}`}>
                  {rowTitle}
                </div>
                <div className="nh-row-desc">{rowDesc}</div>
                <div className="nh-row-meta">Last updated: just now</div>
                <div className="nh-row-actions">
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
                    className="nh-btn"
                    disabled={status === "loading"}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload Photo
                  </button>
                  <button
                    className="nh-btn"
                    disabled={status === "loading"}
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    Use Camera
                  </button>
                  <button
                    className="nh-btn nh-btn-green"
                    disabled={!file || status === "loading"}
                    onClick={handleAnalyze}
                  >
                    {status === "loading" ? "Evaluating..." : "Analyze »"}
                  </button>
                  {file && status !== "loading" && (
                    <button className="nh-btn" onClick={handleReset}>
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div id="testimonials" />
            {FEED.map((item) => (
              <div className="nh-row" key={item.title}>
                <div className="nh-thumb" style={{ width: 80, height: 80 }}>
                  <div
                    className="nh-thumb-placeholder"
                    style={{ fontSize: 16, color: "#ffd23f", fontWeight: "bold" }}
                  >
                    {item.mono}
                  </div>
                </div>
                <div className="nh-row-body">
                  <div className="nh-row-title">{item.title}</div>
                  <div className="nh-row-desc">&ldquo;{item.quote}&rdquo;</div>
                  <div className="nh-row-meta">
                    {item.author} &middot; {item.meta}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="nh-sidebar-right">
          <div className="nh-tabbar">
            <a href="#features" className="active">
              Specs
            </a>
            <a href="#press">News</a>
          </div>
          <div className="nh-panel" id="features" style={{ borderTop: "none" }}>
            <div className="nh-panel-head">PRODUCT SPECS</div>
            <div>
              {FEATURES.map((f) => (
                <div className="nh-featureitem" key={f.title}>
                  <div className="t">{f.title}</div>
                  <div className="d">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="nh-panel" id="press">
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
