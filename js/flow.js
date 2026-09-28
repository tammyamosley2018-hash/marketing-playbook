// The workshop, screen by screen. Order matters: later AI drafts are built from
// the answers and approved drafts that come before them.

const isA = (s) => s.answers.track === "A";
const isB = (s) => s.answers.track === "B";
const hasSvc = (s) => s.answers.svcHas === "yes";

export const SECTIONS = [
  "Brand Voice",
  "Your Business",
  "Your Bio",
  "Market Research",
  "Customer Avatar",
  "Signature Offer",
  "Sales Page",
  "Services",
  "Website Copy",
  "Your Playbook",
];

const HAIR_FIELDS = [
  { key: "years", label: "Years of experience", type: "text" },
  {
    key: "specialties",
    label: "Your specializations",
    type: "checks",
    options: ["Locs (traditional, sister locs, micro locs)", "Natural hair care", "Protective styling", "Hair growth treatments", "Scalp health", "Chemical services (relaxers, texturizers)", "Color services", "Braids and extensions"],
    other: true,
  },
  { key: "list", label: "List every service you offer", hint: 'Be specific — e.g. "Loc retwist", "Silk press", "Deep conditioning treatment". Add prices and times if you know them.', type: "textarea", required: true },
  { key: "ideal", label: "Your ideal clients are…", hint: 'e.g. "Professional women with natural hair", "People starting their loc journey"', type: "textarea" },
  { key: "problems", label: "Main problems you solve", hint: 'e.g. "Dry, brittle hair", "Scalp issues", "Don\'t know how to style natural hair"', type: "textarea" },
  { key: "certs", label: "Certifications / training", type: "text" },
  { key: "different", label: "What makes you different from other stylists?", type: "textarea" },
  { key: "signature", label: "Your signature service or specialty", type: "text" },
  { key: "priceRange", label: "Your services typically range from…", hint: "e.g. $45 to $250", type: "text" },
  { key: "pricingStyle", label: "How do you want prices shown?", type: "radio", options: ["Exact prices for each service", "Price ranges", '"Starting at $X"', '"Contact for pricing"'] },
];

const REIKI_FIELDS = [
  { key: "years", label: "Years practicing Reiki", type: "text" },
  { key: "level", label: "Your Reiki training level", type: "checks", options: ["Reiki Level I", "Reiki Level II", "Reiki Master", "Reiki Master Teacher"], other: true },
  {
    key: "sessionTypes",
    label: "Types of sessions you offer",
    type: "checks",
    options: ["In-person individual sessions", "Distance/remote sessions", "Group sessions", "Reiki classes/attunements", "Chakra balancing", "Crystal healing combined with Reiki", "Sound healing with Reiki", "Animal Reiki"],
    other: true,
  },
  { key: "lengths", label: "Session lengths you offer", type: "checks", options: ["30 minutes", "45 minutes", "60 minutes", "90 minutes", "Package deals"], other: true },
  { key: "list", label: "List your services and session types", hint: "Add prices if you know them.", type: "textarea", required: true },
  { key: "ideal", label: "Your ideal clients are…", hint: 'e.g. "Busy professionals seeking stress relief", "People going through life transitions"', type: "textarea" },
  { key: "problems", label: "Main issues you help clients with", hint: 'e.g. "Stress and anxiety", "Sleep", "Emotional blocks"', type: "textarea" },
  { key: "certs", label: "Other certifications / training", type: "text" },
  { key: "different", label: "What makes your approach unique?", type: "textarea" },
  { key: "signature", label: "Your specialty or focus", hint: 'e.g. "Trauma-informed Reiki", "Corporate wellness"', type: "text" },
  { key: "priceRange", label: "Your sessions typically range from…", type: "text" },
  { key: "pricingStyle", label: "How do you want prices shown?", type: "radio", options: ["Exact prices for each service", "Price ranges", '"Starting at $X"', "Package pricing", '"Investment varies — contact for details"'] },
];

const OTHER_FIELDS = [
  {
    key: "list",
    label: "List your other services",
    hint: "For each one, whatever you know: the name, who it's for, what problem it solves, how long it takes, and the price. Rough notes are fine.",
    type: "textarea",
    rows: 9,
    required: true,
  },
  { key: "extra", label: "Anything else I should know? (optional)", hint: "Packages you already sell, services you want to push, things you don't want to offer anymore…", type: "textarea" },
];

export const SCREENS = [
  { id: "welcome", type: "welcome", section: 0 },

  // ---- Brand voice
  {
    id: "bv1", type: "q", section: 0, key: "bv1",
    intro: "Let's capture YOUR voice — the way you naturally talk. I'll ask three storytelling questions. Just answer like you're talking to a friend; there are no wrong answers.",
    q: "Tell me a story about a defining childhood moment that still lives with you to this day.",
    story: true,
  },
  { id: "bv2", type: "q", section: 0, key: "bv2", q: "Tell me what prompted you to do what you do now for a living.", story: true },
  { id: "bv3", type: "q", section: 0, key: "bv3", q: "Tell me a story about how you've helped someone with your expertise — either in the past or now.", story: true },
  { id: "brandVoice", type: "gen", section: 0, task: "brandVoice", title: "Your Brand Voice Profile", check: "Does this capture how you communicate?" },

  // ---- Business
  {
    id: "track", type: "choice", section: 1, key: "track",
    q: "Do you already have a business up and running, or are you just starting to figure out what business you want to create?",
    options: [
      { v: "B", label: "I already have a business", sub: "I offer services or products now" },
      { v: "A", label: "I'm just starting", sub: "I'm still figuring out my business idea" },
    ],
  },
  { id: "ta1", type: "q", section: 1, key: "ta1", when: isA, q: "What topics, skills, or activities energize you?", hint: "List 5–10 — whatever makes you lose track of time." },
  { id: "ta2", type: "q", section: 1, key: "ta2", when: isA, q: "What problems do you see in the world that frustrate you?" },
  { id: "ta3", type: "q", section: 1, key: "ta3", when: isA, q: "What do people often come to you for advice about?" },
  { id: "ta4", type: "q", section: 1, key: "ta4", when: isA, q: "If money wasn't an issue, what would you spend your time doing?" },
  { id: "ta5", type: "q", section: 1, key: "ta5", when: isA, q: "What change do you want to create in the world?" },
  { id: "tb1", type: "q", section: 1, key: "tb1", when: isB, q: "What services or products do you currently offer?" },
  { id: "tb2", type: "q", section: 1, key: "tb2", when: isB, q: "Who are you currently serving?", hint: "Be as specific as you can." },
  { id: "tb3", type: "q", section: 1, key: "tb3", when: isB, q: "What transformation or result do your clients get?" },
  { id: "tb4", type: "q", section: 1, key: "tb4", when: isB, q: "What's working well in your business right now?" },
  { id: "tb5", type: "q", section: 1, key: "tb5", when: isB, q: "What's NOT working, or what do you want to improve?" },
  { id: "tb6", type: "q", section: 1, key: "tb6", when: isB, q: "What makes you different from others in your field?" },
  {
    id: "business", type: "gen", section: 1, task: "business", title: "Your Business", check: "Does this capture it? What would you change?",
    tip: (s) => (isA(s) ? "If a different idea feels more like you, click “Change something” and tell me which one." : ""),
  },

  // ---- Bio
  {
    id: "bio1", type: "q", section: 2, key: "bio1",
    intro: "Now let's write your professional bio. Four quick questions, one at a time.",
    q: "What's your background and experience?", hint: "Your training or credentials, relevant experience, and how long you've been doing this work.",
  },
  { id: "bio2", type: "q", section: 2, key: "bio2", q: "What makes you different from others in your field?", hint: "Your unique approach or philosophy — why should someone work with YOU?" },
  { id: "bio3", type: "q", section: 2, key: "bio3", q: "What transformation do you help people achieve?", hint: "What's the before → after of working with you? What results have you seen in yourself or others?" },
  { id: "bio4", type: "q", section: 2, key: "bio4", q: "Why do you do this work?", hint: "What drives you? What personal experience led you here?", story: true },
  { id: "bio", type: "gen", section: 2, task: "bio", title: "Your Professional Bio", check: "How does this feel? Does it sound like you?", words: [150, 250] },

  // ---- Research + avatar
  { id: "research", type: "research", section: 3, title: "Your Market Research" },
  { id: "avatar", type: "gen", section: 4, task: "avatar", title: "Your Ideal Customer", check: "Does this feel like the person you want to serve? Anything you'd adjust based on your real clients?" },

  // ---- Offer
  {
    id: "of1", type: "q", section: 5, key: "of1", unsure: true,
    intro: "Time to shape your signature offer — the main thing you want people to buy. If you're not sure about any answer, tap “Not sure — you recommend” and I'll suggest something.",
    q: "What is your main offer, and do you have a name for it?", hint: "e.g. a 12-week coaching program, a signature loc package, a monthly membership…",
  },
  { id: "of2", type: "q", section: 5, key: "of2", unsure: true, q: "Who specifically is this offer for?" },
  { id: "of3", type: "q", section: 5, key: "of3", unsure: true, q: "What problem does it solve, and what result does your client walk away with?" },
  { id: "of4", type: "q", section: 5, key: "of4", unsure: true, q: "How is it delivered?", hint: "Format (1:1, group, course, in-salon…), how long it lasts, what they receive, and where it happens (in person, Zoom, online)." },
  { id: "of5", type: "q", section: 5, key: "of5", unsure: true, q: "What do you want to charge, and how can people pay?", hint: "One-time, payment plan, monthly, per session…" },
  { id: "offer", type: "gen", section: 5, task: "offer", title: "Your Signature Offer", check: "What feels right here? What would you like to adjust?" },

  // ---- Sales page
  { id: "salesPage", type: "gen", section: 6, task: "salesPage", title: "Your Sales Page", check: "Read it through. Does it sound like you, and does it speak to your ideal customer?", words: [800, 1200] },

  // ---- Services
  {
    id: "svcHas", type: "choice", section: 7, key: "svcHas",
    q: "Do you offer other services besides your signature offer?",
    hint: "For example, a hair stylist might offer cuts, color, and styling as separate services.",
    options: [
      { v: "yes", label: "Yes, I have other services" },
      { v: "no", label: "No, just my signature offer" },
    ],
  },
  {
    id: "svcType", type: "choice", section: 7, key: "svcType", when: hasSvc,
    q: "What kind of services do you offer?",
    options: [
      { v: "hair", label: "Hair services", sub: "Stylists, locticians, natural hair care" },
      { v: "reiki", label: "Reiki / energy healing" },
      { v: "other", label: "Something else" },
    ],
  },
  {
    id: "svcForm", type: "form", section: 7, key: "svc", when: hasSvc,
    q: "Tell me about your services",
    hint: "Fill in what you know — skip anything that doesn't apply.",
    fields: (s) => (s.answers.svcType === "hair" ? HAIR_FIELDS : s.answers.svcType === "reiki" ? REIKI_FIELDS : OTHER_FIELDS),
  },
  { id: "services", type: "gen", section: 7, task: "services", when: hasSvc, title: "Your Services Page", check: "Do the services, times, and prices look right?" },

  // ---- Website
  { id: "website", type: "gen", section: 8, task: "website", title: "Your Website Copy", check: "Do these pages capture your message and brand?" },

  // ---- Wrap-up
  {
    id: "prezoom", type: "form", section: 9, key: "prezoom", optional: true,
    q: "Before our Zoom call (optional)",
    hint: "Anything you jot down here helps me come prepared. Totally fine to skip — we'll cover it together.",
    fields: () => [
      { key: "sites", label: "Any websites you love the look of?", hint: "Paste links or names — any industry.", type: "textarea", rows: 3 },
      { key: "colors", label: "Colors you love (or want to avoid)", type: "text" },
      { key: "logo", label: "Do you have a logo?", type: "radio", options: ["Yes", "No", "I'd like help with one"] },
      { key: "photos", label: "Do you have photos of yourself or your work?", type: "radio", options: ["Yes", "Some", "Not yet"] },
      { key: "domain", label: "Do you own a website address (domain)?", hint: "e.g. yourbusiness.com — write it here if so.", type: "text" },
      { key: "notes", label: "Anything else on your mind?", type: "textarea", rows: 3 },
    ],
  },
  { id: "done", type: "done", section: 9 },
];

export const GEN_SCREENS = SCREENS.filter((x) => x.type === "gen" || x.type === "research").map((x) => x.id);
