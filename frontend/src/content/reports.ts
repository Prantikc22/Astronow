import type { FeatherName } from "@/src/components/Icon";
import { displayCurrency } from "@/src/content/pricing";
import { translateText } from "@/src/i18n";

export type ReportDefinition = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: FeatherName;
  tone: "violet" | "rose" | "gold" | "blue";
  featured?: boolean;
  preview?: boolean;
  access?: "plus" | "addon" | "free";
  price?: string;
  listPrice?: string;
  usdPrice?: string;
  usdListPrice?: string;
  discount?: string;
  productId?: string;
  route?: string;
};

export const REPORTS: ReportDefinition[] = [
  { slug: "year-ahead", title: "Your Year Ahead", eyebrow: "12-MONTH MAP", description: "The themes, turning points and timing that shape your next chapter.", icon: "compass", tone: "violet", featured: true, preview: true, access: "plus" },
  { slug: "career-blueprint", title: "Career Blueprint", eyebrow: "WORK & PURPOSE", description: "Strengths, work patterns and periods that support meaningful progress.", icon: "briefcase", tone: "blue", access: "plus" },
  { slug: "love-patterns", title: "Love Patterns", eyebrow: "RELATIONSHIPS", description: "How you connect, communicate and grow inside close relationships.", icon: "heart", tone: "rose", access: "plus" },
  { slug: "wealth-rhythm", title: "Wealth Rhythm", eyebrow: "MONEY", description: "Your decision style, natural resources and long-view money rhythm.", icon: "trending-up", tone: "gold", access: "plus" },
  { slug: "life-purpose", title: "Life Purpose", eyebrow: "SELF & GROWTH", description: "The deeper motivations and lessons running through your birth chart.", icon: "star", tone: "violet", access: "plus" },
  { slug: "marriage-partner", title: "Marriage & Partner", eyebrow: "COMMITMENT", description: "Relationship needs, partnership patterns and the kind of bond you can build well.", icon: "users", tone: "rose", access: "plus" },
  { slug: "ideal-partner", title: "Ideal Partner", eyebrow: "RELATIONSHIP FIT", description: "The qualities, emotional rhythms and values that help partnership feel sustainable.", icon: "heart", tone: "rose", access: "plus" },
  { slug: "family-dynamics", title: "Family Dynamics", eyebrow: "HOME & BELONGING", description: "How you care, set boundaries and create steadier relationships at home.", icon: "home", tone: "rose", access: "plus" },
  { slug: "business-enterprise", title: "Business & Enterprise", eyebrow: "BUILD & LEAD", description: "Your enterprise style, risk rhythm and strengths as a builder or independent leader.", icon: "bar-chart-2", tone: "blue", access: "plus" },
  { slug: "first-job", title: "First Job & Search", eyebrow: "STARTING OUT", description: "A grounded map for early career choices, interviews and the strengths worth proving.", icon: "search", tone: "blue", access: "plus" },
  { slug: "public-service", title: "Public Service", eyebrow: "STRUCTURE & SERVICE", description: "Your fit for structured institutions, responsibility and long-horizon preparation.", icon: "shield", tone: "blue", access: "plus" },
  { slug: "education-path", title: "Education Path", eyebrow: "LEARNING", description: "How you learn best, where curiosity compounds and how to choose a useful direction.", icon: "book-open", tone: "violet", access: "plus" },
  { slug: "intelligence-strengths", title: "Mind & Intelligence", eyebrow: "THINKING STYLE", description: "How you process ideas, communicate, solve problems and build confidence in your mind.", icon: "zap", tone: "violet", access: "plus" },
  { slug: "health-wellbeing", title: "Wellbeing Rhythms", eyebrow: "ENERGY & REST", description: "Reflective patterns for stress, rest and sustainable routines—never medical prediction.", icon: "activity", tone: "gold", access: "plus" },
  { slug: "match-report", title: "Compatibility Match", eyebrow: "TWO BIRTH CHARTS", description: "A complete relationship report covering emotional rhythm, communication and growth edges.", icon: "heart", tone: "rose", access: "addon", price: "₹249", listPrice: "₹498", usdPrice: "$2.99", usdListPrice: "$5.98", discount: "50% OFF", productId: "report_match", route: "/compatibility" },
  { slug: "artha-strategy", title: "Artha Strategy", eyebrow: "WEALTH & RESPONSIBILITY", description: "Artha means practical prosperity: a chart-led playbook for work, resources and thoughtful decisions.", icon: "award", tone: "gold", access: "addon", price: "₹299", listPrice: "₹598", usdPrice: "$3.99", usdListPrice: "$7.98", discount: "50% OFF", productId: "report_artha_strategy" },
  { slug: "twelve-year-compass", title: "The 12-Year Compass", eyebrow: "LONG-RANGE CYCLE", description: "A long-range map of the twelve years ahead, with themes for growth, timing and renewal.", icon: "navigation", tone: "violet", access: "addon", price: "₹399", listPrice: "₹798", usdPrice: "$4.99", usdListPrice: "$9.98", discount: "50% OFF", productId: "report_12_year_compass" },
];

export function reportPrice(report: ReportDefinition, list = false): string {
  if (displayCurrency() === "INR") return (list ? report.listPrice : report.price) || "See store";
  return (list ? report.usdListPrice : report.usdPrice) || "See store";
}

export function reportDisplay(report: ReportDefinition, terminologyMode?: string): Pick<ReportDefinition, "title" | "eyebrow" | "description"> {
  if (report.slug !== "artha-strategy" || terminologyMode !== "simple") return report;
  return {
    title: "Financial Plan",
    eyebrow: "MONEY & DECISIONS",
    description: "A chart-based guide to resources, work and thoughtful financial decisions.",
  };
}

export function reportSections(slug: string, data: any, language = "en", terminologyMode = "both") {
  const chart = data?.chart?.chart || {};
  const today = data?.today || {};
  const dasha = data?.dasha || {};
  const number = data?.numerology || {};
  const moon = chart.moon_sign || today.moon_today?.sign || "your Moon sign";
  const sun = chart.sun_sign || "your Sun sign";
  const ascendant = chart.lagna?.sign || "your Ascendant";
  const period = dasha.current_mahadasha?.lord || today.current_period?.mahadasha || "your current life period";
  const subperiod = dasha.current_antardasha?.lord || today.current_period?.antardasha;
  const periodText = subperiod ? `${period}–${subperiod}` : period;
  const lifePath = number.life_path || "your life-path number";

  if (slug === "twelve-year-compass") {
    return twelveYearSections(dasha, periodText, moon, language);
  }

  const shared = {
    "year-ahead": [
      ["The chapter you are in", `Your ${periodText} period is the main lens for this chapter. It describes the kind of growth asking for sustained attention—not a fixed prediction, but a useful rhythm for choosing where to invest your energy.`],
      ["Your emotional compass", `With the Moon in ${moon}, decisions tend to become clearer when they feel internally settled. Build pauses into major choices so instinct and evidence have time to meet.`],
      ["The practical invitation", today.insight || "Choose fewer priorities and stay with them long enough to see what is actually changing."],
    ],
    "career-blueprint": [
      ["How you naturally contribute", `${ascendant} rising shapes how you enter new situations, while your ${sun} Sun points to the kind of contribution that restores confidence. Your best work joins visible strength with a pace you can sustain.`],
      ["Your working rhythm", `The ${periodText} period can place particular emphasis on the skills and responsibilities linked with those planetary themes. Use it as a planning horizon rather than a deadline.`],
      ["A grounded next move", "Name the work you want to become known for, then make the next project prove one part of that reputation."],
    ],
    "love-patterns": [
      ["How you seek safety", `Your ${moon} Moon describes the emotional conditions that help you feel understood. Ask for those conditions plainly instead of testing whether another person can guess them.`],
      ["How you show up", `${ascendant} rising can colour the first impression you make. The deeper relationship begins when that outer style has room to soften into honest communication.`],
      ["A practice for closeness", "Replace one assumption with one curious question. The quality of the answer matters less than the safety created by asking."],
    ],
    "wealth-rhythm": [
      ["Your decision temperament", `A life path of ${lifePath} can describe a recurring way you organise effort and meaning. Use that pattern to design a money system you will actually return to.`],
      ["The current cycle", `Your ${periodText} period is the backdrop for long-horizon choices. Favour decisions that remain sensible even if the timing takes longer than hoped.`],
      ["A practical principle", "Separate security, growth and generosity into distinct buckets. Clarity improves when every rupee has only one job."],
    ],
    "life-purpose": [
      ["The self you are becoming", `${ascendant} rising, a ${sun} Sun and ${moon} Moon create a conversation between how you begin, how you shine and what you need emotionally.`],
      ["The lesson of this season", `The ${periodText} period highlights a particular curriculum for this chapter. Notice which responsibilities keep returning; repetition often marks the lesson worth mastering.`],
      ["A question to carry", "What would you keep practising even if nobody applauded yet? Purpose is often hiding inside that answer."],
    ],
    "marriage-partner": [
      ["What partnership needs from you", `Your ${moon} Moon describes the conditions that help affection feel safe, while ${ascendant} rising shapes how you first approach closeness. Lasting partnership asks both parts to be seen.`],
      ["Commitment and communication", `During a ${periodText} period, familiar relationship themes may become easier to name. Treat that awareness as an invitation to communicate, not as a verdict about another person.`],
      ["A relationship practice", "Agree on how you will repair small misunderstandings before they become large ones. Consistency is often more romantic than intensity."],
    ],
    "ideal-partner": [
      ["What emotional fit means for you", `Your ${moon} Moon points to the conditions that help closeness feel safe. A supportive partner does not need to mirror you, but should be willing to understand that emotional pace.`],
      ["The qualities that last", `${ascendant} rising shapes what catches your attention first; your ${sun} Sun speaks more to the kind of mutual respect that keeps attraction alive.`],
      ["A better filter", "Look beyond chemistry: notice how someone handles repair, boundaries, money conversations and your independent goals."],
    ],
    "family-dynamics": [
      ["Your role at home", `A ${moon} Moon can describe the kind of emotional labour you take on instinctively. Care becomes more sustainable when it is named and shared.`],
      ["Boundaries in this season", `The ${periodText} period can make recurring responsibilities easier to see. Decide which are truly yours before promising more.`],
      ["A family practice", "Hold one short weekly conversation about practical needs before they become emotional emergencies."],
    ],
    "business-enterprise": [
      ["Your builder's advantage", `${ascendant} rising affects how you initiate, while a ${sun} Sun describes the contribution that strengthens your confidence. Your best enterprise model lets initiative and mastery reinforce one another.`],
      ["Risk and timing", `The ${periodText} period is the current backdrop. Use it to choose the kind of risk worth studying, while keeping cash, contracts and assumptions visible.`],
      ["A founder's next move", "Write down the one advantage customers can actually feel. Build the next month around proving it repeatedly."],
    ],
    "education-path": [
      ["How knowledge sticks", `A ${moon} Moon often learns best when information has emotional relevance, while ${lifePath} adds a recurring pattern to how you organise meaning.`],
      ["Where to deepen", `Your ${periodText} period can highlight subjects connected with its planetary themes. Choose a course of study that produces both curiosity and usable evidence of skill.`],
      ["A learning system", "Pair every hour of input with a small output: a note, explanation, project or conversation. Knowledge compounds when it leaves your head."],
    ],
    "first-job": [
      ["Your first proof", `${ascendant} rising shapes how you enter new environments, while your ${sun} Sun points to work that strengthens confidence. Choose roles that let you demonstrate both learning speed and reliability.`],
      ["How to search", `During a ${periodText} period, focused skill-building can matter more than scattering applications. Turn one skill into visible evidence.`],
      ["A practical sprint", "Choose ten realistic roles, tailor one strong proof of work, and ask three people for precise feedback on your positioning."],
    ],
    "public-service": [
      ["Structure and service", `${ascendant} rising and your ${sun} Sun describe how initiative and responsibility meet. Structured work suits you best when the mission feels meaningful, not merely secure.`],
      ["Preparation rhythm", `The ${periodText} period offers a planning backdrop, not an exam-result prediction. Build a preparation system that survives low-motivation days.`],
      ["A grounded decision", "Compare the role's real daily work, time horizon and opportunity cost—not only its status or perceived safety."],
    ],
    "intelligence-strengths": [
      ["How your mind makes meaning", `Your ${moon} Moon influences what captures attention emotionally, while a life path of ${lifePath} adds a recurring way of organising ideas.`],
      ["Communication strength", `Your ${sun} Sun points to the voice that becomes clearer with practice. Intelligence becomes visible when you can explain a complex idea simply.`],
      ["A learning experiment", "Use one week to alternate input and output: learn, explain from memory, test, then refine."],
    ],
    "health-wellbeing": [
      ["Your energy language", `Your ${moon} Moon can be used as a reflective lens for emotional replenishment—not as a diagnosis. Notice which routines consistently leave you calmer and clearer.`],
      ["Sustainable pace", `The ${periodText} period may symbolically emphasize certain responsibilities. Protect sleep, movement and recovery as foundations rather than rewards.`],
      ["A safe next step", "Track energy and stress for two weeks. For symptoms or health concerns, use that record with a qualified clinician rather than relying on astrology."],
    ],
    "artha-strategy": [
      ["Your resource position", `${ascendant} rising, your ${sun} Sun and ${moon} Moon describe three different assets: initiative, visible strength and instinct. Artha grows when these assets are directed rather than scattered.`],
      ["Leverage in this chapter", `The ${periodText} period frames where patience, alliances and disciplined effort can compound. Favour durable leverage—skills, systems, reputation and reserves—over fragile shortcuts.`],
      ["Money architecture", "Create three separate ledgers for survival, expansion and opportunity. Protect the first, automate the second and deploy the third only when the downside is understood."],
      ["Negotiation and power", "Enter important negotiations knowing your alternative, your non-negotiables and the value you create. Responsible power begins with clarity."],
      ["Your 90-day campaign", "Choose one wealth engine, one capability to strengthen and one relationship to cultivate. Review evidence every fortnight and change tactics without abandoning the objective."],
    ],
  } as Record<string, string[][]>;
  const sections = shared[slug] || shared["year-ahead"];
  const localized = localizeSections(sections, language, { ascendant, sun, moon, periodText, lifePath });
  if (slug === "artha-strategy" && terminologyMode === "simple" && language === "en") {
    return localized.map(([title, body]) => [title, body.replace("Artha grows", "Financial progress grows")]);
  }
  return localized;
}

function localizeTemplate(value: string, language: string, replacements: Record<string, string | number>): string {
  if (language === "en") return value;
  const entries = Object.entries(replacements)
    .filter(([, replacement]) => String(replacement).length > 0)
    .sort((a, b) => String(b[1]).length - String(a[1]).length);
  let key = value;
  for (const [name, replacement] of entries) key = key.split(String(replacement)).join(`\${${name}}`);
  let translated = translateText(key, language);
  for (const [name, replacement] of entries) translated = translated.split(`\${${name}}`).join(String(replacement));
  return translated;
}

function localizeSections(
  sections: string[][],
  language: string,
  replacements: Record<string, string | number>,
): string[][] {
  return sections.map(([title, body]) => [
    localizeTemplate(title, language, replacements),
    localizeTemplate(body, language, replacements),
  ]);
}

const PERIOD_FOCUS: Record<string, string> = {
  Sun: "leadership, visibility and the work of defining your own standards",
  Moon: "belonging, emotional steadiness and the foundations that support good decisions",
  Mars: "focused action, courage and knowing when to pause before pushing",
  Mercury: "learning, communication and useful commercial connections",
  Jupiter: "mentorship, education and thoughtful expansion",
  Venus: "relationships, craft, pleasure and sustainable resources",
  Saturn: "structure, responsibility and gains earned through consistency",
  Rahu: "experimentation, ambition and the discipline to test bold ideas",
  Ketu: "simplification, inner clarity and releasing commitments that no longer fit",
};

const YEAR_PRACTICES = [
  "Take inventory of your commitments and protect one dependable routine.",
  "Deepen a skill that will still matter in five years.",
  "Strengthen an alliance through clear, reciprocal expectations.",
  "Turn a promising idea into a small public proof of work.",
  "Review cash, time and attention before taking on more responsibility.",
  "Ask a mentor for an honest view of your next level.",
  "Simplify what has become expensive to maintain.",
  "Invest in the relationships and systems that make growth repeatable.",
  "Test a new direction without risking the foundation you have built.",
  "Consolidate what is working and document the lessons.",
  "Share expertise generously while preparing the next chapter.",
  "Look back over the full arc and choose what deserves renewal.",
];

function twelveYearSections(dasha: any, periodText: string, moon: string, language: string): string[][] {
  const firstYear = new Date().getFullYear();
  const periods: any[] = dasha.mahadashas || [];
  const timeline = Array.from({ length: 12 }, (_, index) => {
    const year = firstYear + index;
    // The midpoint avoids presenting a calendar-year boundary as a precise transit.
    const midpoint = new Date(Date.UTC(year, 6, 1));
    const matching = periods.find((item) => {
      const start = item.start ? new Date(item.start) : new Date(Date.UTC(item.start_year, 0, 1));
      const end = item.end ? new Date(item.end) : new Date(Date.UTC(item.end_year, 0, 1));
      return start <= midpoint && midpoint < end;
    });
    const lord = matching?.lord || dasha.current_mahadasha?.lord || "Jupiter";
    const focus = PERIOD_FOCUS[lord] || "deliberate growth and reflection";
    const localizedFocus = translateText(focus, language);
    const localizedPractice = translateText(YEAR_PRACTICES[index], language);
    return localizeSections([[
      `Year ${index + 1} · ${year}`,
      `The ${lord} life-period theme points toward ${localizedFocus}. With your Moon in ${moon}, notice what feels steady enough to sustain. ${localizedPractice} This is a planning theme, not a prediction of a specific event.`,
    ]], language, {
      "index + 1": index + 1,
      year,
      lord,
      focus: localizedFocus,
      moon,
      "YEAR_PRACTICES[index]": localizedPractice,
    })[0];
  });
  return localizeSections([
    ["Your long-range compass", `The ${periodText} period begins this twelve-year view. Each year below is anchored to the major life period active around midyear; it is a reflective planning map, not a promise about events or an exact Jupiter-transit forecast.`],
    ...timeline,
  ], language, { periodText });
}
