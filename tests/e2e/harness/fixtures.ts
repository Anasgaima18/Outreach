/**
 * Academic Faculty Datasets, CSV Fixtures, GamifyTL Verified Templates, and Utility Validators.
 */

export interface FacultyContactFixture {
  firstName: string;
  lastName: string;
  email: string;
  institution: string;
  department: string;
  academicRole: string;
  country: string;
  website: string;
}

export const FACULTY_FIXTURES: FacultyContactFixture[] = [
  {
    firstName: 'David',
    lastName: 'Malan',
    email: 'david.malan@harvard.edu',
    institution: 'Harvard University',
    department: 'Computer Science',
    academicRole: 'Gordon McKay Professor of the Practice of Computer Science',
    country: 'United States',
    website: 'https://cs50.harvard.edu',
  },
  {
    firstName: 'Leslie',
    lastName: 'Valiant',
    email: 'leslie.valiant@seas.harvard.edu',
    institution: 'Harvard University',
    department: 'Computer Science',
    academicRole: 'T. Jefferson Coolidge Professor of Computer Science',
    country: 'United States',
    website: 'https://seas.harvard.edu',
  },
  {
    firstName: 'Andrew',
    lastName: 'Wiles',
    email: 'andrew.wiles@maths.ox.ac.uk',
    institution: 'University of Oxford',
    department: 'Mathematical Institute',
    academicRole: 'Regius Professor of Mathematics',
    country: 'United Kingdom',
    website: 'https://www.maths.ox.ac.uk',
  },
  {
    firstName: 'Martin',
    lastName: 'Hairer',
    email: 'martin.hairer@maths.ox.ac.uk',
    institution: 'University of Oxford',
    department: 'Mathematical Institute',
    academicRole: 'Professor of Mathematics',
    country: 'United Kingdom',
    website: 'https://www.maths.ox.ac.uk',
  },
  {
    firstName: 'Aris',
    lastName: 'Thorne',
    email: 'a.thorne@cl.cam.ac.uk',
    institution: 'University of Cambridge',
    department: 'Department of Computer Science and Technology',
    academicRole: 'Reader in Distributed Systems',
    country: 'United Kingdom',
    website: 'https://www.cst.cam.ac.uk',
  },
  {
    firstName: 'Elena',
    lastName: 'Rostova',
    email: 'e.rostova@ethz.ch',
    institution: 'ETH Zürich',
    department: 'Department of Computer Science',
    academicRole: 'Associate Professor of Systems Architecture',
    country: 'Switzerland',
    website: 'https://inf.ethz.ch',
  },
  {
    firstName: 'Donald',
    lastName: 'Kossmann',
    email: 'donald.kossmann@inf.ethz.ch',
    institution: 'ETH Zürich',
    department: 'Department of Computer Science',
    academicRole: 'Professor of Data Systems',
    country: 'Switzerland',
    website: 'https://inf.ethz.ch',
  },
  {
    firstName: 'Yuki',
    lastName: 'Tanaka',
    email: 'yuki.tanaka@u-tokyo.ac.jp',
    institution: 'University of Tokyo',
    department: 'Department of Information Science',
    academicRole: 'Associate Professor',
    country: 'Japan',
    website: 'https://www.u-tokyo.ac.jp',
  },
  {
    firstName: 'François',
    lastName: 'Labourie',
    email: 'francois.labourie@unice.fr',
    institution: 'Université Côte d\'Azur',
    department: 'Laboratoire J.A. Dieudonné',
    academicRole: 'Professeur des Universités',
    country: 'France',
    website: 'https://math.unice.fr',
  },
  {
    firstName: 'Jürgen',
    lastName: 'Schmidt',
    email: 'juergen.schmidt@tum.de',
    institution: 'Technische Universität München',
    department: 'Department of Informatics',
    academicRole: 'Chair of Software Engineering',
    country: 'Germany',
    website: 'https://www.tum.de',
  },
  {
    firstName: 'Inês',
    lastName: 'Gonçalves',
    email: 'ines.goncalves@usp.br',
    institution: 'Universidade de São Paulo',
    department: 'Escola Politécnica',
    academicRole: 'Professora Titular',
    country: 'Brazil',
    website: 'https://www.poli.usp.br',
  },
  {
    firstName: 'Fatima',
    lastName: 'Al-Zahra',
    email: 'fatima.alzahra@aub.edu.lb',
    institution: 'American University of Beirut',
    department: 'Computer Science',
    academicRole: 'Assistant Professor',
    country: 'Lebanon',
    website: 'https://www.aub.edu.lb',
  },
];

export const VALID_PROFESSORS_CSV = `email,first_name,last_name,institution,department,role,country,website
david.malan@harvard.edu,David,Malan,Harvard University,Computer Science,Professor of the Practice,United States,https://cs50.harvard.edu
andrew.wiles@maths.ox.ac.uk,Andrew,Wiles,University of Oxford,Mathematical Institute,Regius Professor of Mathematics,United Kingdom,https://www.maths.ox.ac.uk
francois.labourie@unice.fr,François,Labourie,Université Côte d'Azur,Laboratoire J.A. Dieudonné,Professeur des Universités,France,https://math.unice.fr
yuki.tanaka@u-tokyo.ac.jp,Yuki,Tanaka,University of Tokyo,Department of Information Science,Associate Professor,Japan,https://www.u-tokyo.ac.jp
e.rostova@ethz.ch,Elena,Rostova,ETH Zürich,Department of Computer Science,Associate Professor,Switzerland,https://inf.ethz.ch
`;

export const MALFORMED_PROFESSORS_CSV = `email,first_name,last_name,institution,department,role,country,website
invalid-email-address,John,Smith,MIT,Physics,Professor,United States,https://mit.edu
user@domain_without_tld,Jane,Doe,Stanford,Biology,Lecturer,United States,https://stanford.edu
@missing_localpart.edu,Bob,Jones,Yale,Chemistry,Assistant Professor,United States,https://yale.edu
prof#with_hash@cam.ac.uk,Alice,Brown,Cambridge,Math,Dean,United Kingdom,https://cam.ac.uk
`;

export const DUPLICATE_PROFESSORS_CSV = `email,first_name,last_name,institution,department,role,country,website
david.malan@harvard.edu,David,Malan,Harvard University,Computer Science,Professor,United States,https://cs50.harvard.edu
david.malan@harvard.edu,David,Malan,Harvard University,CS Dept,Full Professor,United States,https://cs50.harvard.edu
DAVID.MALAN@HARVARD.EDU,D.,Malan,Harvard,CS,Professor,United States,https://cs50.harvard.edu
unique.prof@oxford.ac.uk,Unique,Professor,Oxford,Math,Lecturer,United Kingdom,https://ox.ac.uk
`;

export const UNICODE_PROFESSORS_CSV = `email,first_name,last_name,institution,department,role,country,website
juergen.schmidt@tum.de,Jürgen,Schmidt,Technische Universität München,Informatik,Ordinarius,Germany,https://tum.de
ines.goncalves@usp.br,Inês,Gonçalves,Universidade de São Paulo,Engenharia,Professora Titular,Brazil,https://usp.br
t.sato@kyoto-u.ac.jp,健太,佐藤,京都大学,理学研究科,准教授,Japan,https://kyoto-u.ac.jp
fatima.alzahra@aub.edu.lb,فاطمة,الزهراء,American University of Beirut,Computer Science,Assistant Professor,Lebanon,https://aub.edu.lb
`;

export function generateLargeProfessorsCsv(count: number): string {
  const lines = ['email,first_name,last_name,institution,department,role,country,website'];
  for (let i = 1; i <= count; i++) {
    lines.push(`educator_${i}@university-${i}.edu,First${i},Last${i},Institution ${i},Department ${i},Professor,United States,https://univ-${i}.edu`);
  }
  return lines.join('\n');
}

/**
 * Verified GamifyTL Outreach Templates
 * Strictly built around verified features:
 * - 8 Interactive Classroom Games (Quiz Battle, Polls, etc.)
 * - Zero Student App Installs (<3 second join via QR code or URL gamifytl.com/join)
 * - Resource Drop (peer-to-peer classroom file distribution)
 * - No unverified partnership or adoption claims
 */
export const GAMIFYTL_TEMPLATES = {
  templateA_engagement: {
    name: 'Active Classroom Engagement for STEM Lectures',
    subject: 'GamifyTL: Interactive Classroom Engagement for {{department}} at {{institution}}',
    bodyText: `Dear Professor {{last_name}},

I am reaching out from GamifyTL. We noticed your academic work in the {{department}} at {{institution}}.

Maintaining sustained student attention during technical lectures can be challenging, especially with smartphone distraction. We built GamifyTL to turn student mobile devices into active lecture participation tools.

Key capabilities:
- Zero student app installs: Students join in under 3 seconds via QR code or gamifytl.com/join.
- Interactive games: Real-time Quiz Battle, Polls, and Knowledge Checks designed directly for university auditoriums.
- Resource Drop: Share slides, problem sets, and code files directly to student browsers instantly.

Would you be open to a 5-minute preview of how GamifyTL works in live classroom settings?

Sincerely,
GamifyTL Academic Outreach Team
https://gamifytl.com/
`,
    bodyHtml: `<p>Dear Professor {{last_name}},</p>
<p>I am reaching out from GamifyTL. We noticed your academic work in the {{department}} at {{institution}}.</p>
<p>Maintaining sustained student attention during technical lectures can be challenging, especially with smartphone distraction. We built GamifyTL to turn student mobile devices into active lecture participation tools.</p>
<p><strong>Key capabilities:</strong></p>
<ul>
  <li><strong>Zero student app installs:</strong> Students join in under 3 seconds via QR code or <a href="https://gamifytl.com/join">gamifytl.com/join</a>.</li>
  <li><strong>Interactive games:</strong> Real-time Quiz Battle, Polls, and Knowledge Checks designed directly for university auditoriums.</li>
  <li><strong>Resource Drop:</strong> Share slides, problem sets, and code files directly to student browsers instantly.</li>
</ul>
<p>Would you be open to a 5-minute preview of how GamifyTL works in live classroom settings?</p>
<p>Sincerely,<br/>GamifyTL Academic Outreach Team<br/><a href="https://gamifytl.com/">gamifytl.com</a></p>
`,
  },
  templateB_zeroInstall: {
    name: 'Zero-Install Classroom Quizzes & Polls',
    subject: 'Frictionless lecture polling for {{institution}} students',
    bodyText: `Dear Professor {{last_name}},

Most classroom response systems require student account creation or app downloads, eating into valuable lecture minutes.

GamifyTL provides instant, zero-install classroom polling and quiz battles:
- Students scan a QR code or visit gamifytl.com/join and participate in seconds.
- Works on any browser or mobile device without logins.
- Immediate visual feedback on student comprehension for {{department}} topics.

You can try a live demo at https://gamifytl.com/. Let us know if you would like a personalized demonstration for your upcoming courses at {{institution}}.

Best regards,
GamifyTL Outreach
`,
  },
  templateC_resourceDrop: {
    name: 'Instant Classroom Resource Drop',
    subject: 'Instant file distribution for {{department}} lectures',
    bodyText: `Dear Professor {{last_name}},

Sharing lecture resources, datasets, or code files during live class usually requires LMS logins or Google Drive links.

GamifyTL includes Resource Drop, allowing professors to push files directly to all connected student screens during class with one click. Combined with our 8 live classroom mini-games, it provides a seamless engagement platform.

Explore more at https://gamifytl.com/.

Kind regards,
GamifyTL Team
`,
  },
  followUp: {
    subject: 'Re: GamifyTL for {{institution}} lectures',
    bodyText: `Dear Professor {{last_name}},

Following up briefly on my earlier note regarding GamifyTL's zero-install classroom engagement platform for {{institution}}.

If you have a couple of minutes this week, you can test a live game session at https://gamifytl.com/ or let us know if you'd like a brief walkthrough.

Best regards,
GamifyTL Academic Outreach Team
`,
  },
};

/**
 * Prohibited claims linter
 * Detects fabricated claims, fake student numbers, fake institutional partnerships.
 */
export function lintEmailContent(content: string): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const lower = content.toLowerCase();

  const bannedPatterns = [
    { pattern: /million(s)? of students/i, reason: 'Unverified student count claim' },
    { pattern: /(partnered with|across) (500|1000|hundreds of|\d+) universities/i, reason: 'Fabricated institutional partnership count' },
    { pattern: /endorsed by harvard/i, reason: 'Fabricated university endorsement' },
    { pattern: /100% (inbox placement|delivery guarantee)/i, reason: 'Unrealistic deliverability guarantee' },
    { pattern: /award winning lecture tool/i, reason: 'Unverified award claim' },
    { pattern: /revolutionary ai-powered/i, reason: 'Violates AI exclusion constraint' },
  ];

  for (const b of bannedPatterns) {
    if (b.pattern.test(lower)) {
      violations.push(b.reason);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Formats direct Gmail conversation thread link (RFC compliant URL encoding).
 */
export function formatGmailThreadLink(accountEmail: string, threadId: string): string {
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(accountEmail)}#all/${encodeURIComponent(threadId)}`;
}
