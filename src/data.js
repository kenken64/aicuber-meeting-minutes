export const meeting = {
  title: 'AI demonstrations & creative review',
  subtitle: 'Kenneth, Lee & Jackson',
  date: '14 Oct 2026 · 22:05 GMT+8',
  summary: 'Kenneth demonstrated AI gaming analysis, voice and graphical avatars, image conversion, document adaptation, and an AI game-building tutorial. Jackson identified document retrieval, appendix summaries, and subscribed case-database search as useful assistant workflows. The team reviewed and revised the Malay storybook, then discussed source credits, possible sale, and the omitted chicken. The omission received an explanation before the meeting closed.',
  attendees: [
    { name: 'Kenneth Phang Tak Yan', short: 'Kenneth', role: 'Organizer', initials: 'KP' },
    { name: 'Lee', short: 'Lee', role: 'External attendee', initials: 'LE' },
    { name: "Jackson’s iPhone", short: 'Jackson', role: 'External attendee', initials: 'JA' },
  ],
};

export const topics = [
  ['AI Casino Gaming System Demo', 'Kenneth demonstrated baccarat and blackjack analysis and described weekly retraining. The minutes do not establish prediction accuracy.'],
  ['AI Avatar Product Demo Discussion', 'Graphical and voice interfaces were demonstrated. Jarvis and the Google avatar system still needed integration.'],
  ['AI-3D Modeling Workflow Integration Challenges', 'The group discussed file compatibility, manual data preparation, and paid access to tools.'],
  ['AI Image Processing Demonstration', 'A photo-to-cartoon workflow was demonstrated, with file access and permissions issues.'],
  ['AI Document Processing Discussion', 'The group tested summarization and translation with Chinese documents.'],
  ['AI Capabilities and Content Adaptation', 'Kenneth agreed to produce a cinematic PDF adaptation with original illustrations. Legal-database access was also discussed.'],
  ['AI Security and Workplace Practices', 'The discussion covered context poisoning, prompt injection, and workplace practices. These are meeting claims, not independently verified findings.'],
  ['AI Game Design Education Platform', 'Kenneth and Lee discussed helping children build characters, stories, and game mechanics with AI.'],
  ['Storybook review and revision', 'At 00:22–00:27, Jackson criticized repeated storybook images and text-image mismatches. The revised 14-page book was reviewed at 00:44–00:47. The short summary places this criticism under the game demonstration.'],
  ['Video Game and AI Discussion', 'The team discussed game history, downloading and testing a codebase, and AI behavior.'],
  ['Closing storybook discussion', 'The commercial-use and credit questions were distinct from the chicken question. At 00:58:53 Jackson read an explanation that the chicken was not specified as a recurring illustration element. He acknowledged it at 00:59:09; there was no explicit restoration commitment.'],
  ['Final exchange: personal assistant', 'At 00:59:34–00:59:49, Kenneth returned to Jarvis use cases and Jackson said he already had something in mind. This, rather than the chicken discussion, is the transcript’s final substantive exchange.'],
];

export const initialActions = [
  { id: 'A01', title: 'Share the Chrome extension URL and installation instructions', owner: 'Kenneth', kind: 'Recorded', status: 'Unconfirmed', due: '', priority: 'Normal', topic: 'AI application', source: 'Next steps → Kenneth', evidence: 'Provide Lee with the URL and instructions to install the Chrome extension for the AI application.', acceptance: 'Lee has the working URL and can install the extension.', notes: '' },
  { id: 'A02', title: 'Integrate Jarvis into the main application', owner: 'Kenneth', kind: 'Recorded', status: 'Unconfirmed', due: '', priority: 'Normal', topic: 'Avatar integration', source: 'Next steps → Kenneth', evidence: 'Integrate the graphical avatar (Jarvis) into the main application.', acceptance: 'Demonstrate the integrated graphical avatar in the main application.', notes: '' },
  { id: 'A03', title: 'Publish the game tutorial and assets on a web platform', owner: 'Kenneth', kind: 'Recorded', status: 'Unconfirmed', due: '', priority: 'Normal', topic: 'Game education', source: 'Next steps → Kenneth', evidence: 'Publish the game development tutorial and assets on a web platform.', acceptance: 'A tutorial URL and downloadable assets are available for Lee to test.', notes: '' },
  { id: 'A04', title: 'Test the game tutorial and share feedback', owner: 'Lee', kind: 'Recorded', status: 'Unconfirmed', due: '', priority: 'Normal', topic: 'Game education', source: 'Next steps → Lee', evidence: 'Test the game development tutorial by following the steps and provide feedback.', acceptance: 'Follow the published steps and record problems and suggested improvements. Depends on A03.', notes: '' },
  { id: 'A05', title: 'Identify use cases for a personal AI assistant', owner: 'Jackson', kind: 'Recorded', status: 'Unconfirmed', due: '', priority: 'Normal', topic: 'AI assistant', source: "Next steps → Jackson’s", evidence: 'Consider use cases for implementing an AI assistant (Javis) for his own needs.', acceptance: 'Share a short list of personal use cases and the most useful first workflow.', notes: '' },
  { id: 'F01', title: 'Optionally decide whether to restore the recurring chicken', owner: '', kind: 'Suggested', status: 'Proposed', due: '', priority: 'Normal', topic: 'Final discussion', source: 'Transcript 15 Oct 00:51:37–00:59:22; original pp. 4–8, 10–11; V2 p. 3', evidence: 'The omission was explained at 00:58:53. Jackson acknowledged the explanation at 00:59:09. The original has a recurring illustrated chicken; V2 mentions ayam once. No commitment to restore it was recorded.', acceptance: 'Only if desired, agree which scenes should contain a chicken. Do not treat the question about omission as an agreed change request.', notes: '' },
  { id: 'F02', title: 'Confirm the attribution and adaptation note for the release', owner: '', kind: 'Suggested', status: 'Proposed', due: '', priority: 'High', topic: 'Final discussion', source: 'Original p. 12; V1 p. 12; V2 p. 14; CC BY 3.0 deed', evidence: 'All three PDFs include source attribution and license information. The record does not demonstrate that copyright required the chicken’s removal.', acceptance: 'Check creator credits, source and license links, and the description of changes against the intended release. Suggested owner to confirm: Lee.', notes: '' },
  { id: 'F03', title: 'Confirm final editorial approval of V2', owner: '', kind: 'Suggested', status: 'Proposed', due: '', priority: 'Normal', topic: 'Final discussion', source: 'Transcript 15 Oct 00:22:07–00:26:49 and 00:44:15–00:47:05; V2 pp. 3–13', evidence: 'V2 was reviewed during the meeting. At 00:46:21 Jackson observed a different picture. Its 11 main scene illustrations are distinct. A formal release decision was not recorded.', acceptance: 'Confirm the preferred version and whether all scene-text matches and continuity details are acceptable for release.', notes: '' },
  { id: 'F04', title: 'Define the first assistant pilot from Jackson’s stated needs', owner: '', kind: 'Suggested', status: 'Proposed', due: '', priority: 'Normal', topic: 'AI assistant', source: 'Transcript 14 Oct 23:40:22–23:43:25, 23:55:02–23:55:56; 15 Oct 00:49:53–00:50:26, 00:59:39', evidence: 'Jackson already described document retrieval, appendix summaries, case-database search, and form filling. The closing exchange confirms he has a use case in mind.', acceptance: 'Choose one first workflow, agree the inputs and expected output, and define authorized access. Suggested owner to confirm: Jackson with Kenneth.', notes: '' },
  { id: 'T01', title: 'Produce and revise the Malay cinematic storybook', owner: 'Kenneth', kind: 'Transcript', status: 'Produced', due: '', priority: 'Normal', topic: 'Storybook', source: 'Transcript 14 Oct 23:52:30–23:53:51; 15 Oct 00:25:19, 00:34:44, 00:44:15–00:46:21', evidence: 'Kenneth requested a new cinematic PDF, then a revision. The 14-page revised edition was shown and Jackson noted a different picture. Both PDFs are supplied.', acceptance: 'Artifact production and in-meeting review are evidenced. Final publication approval remains separate.', notes: 'Observed at the meeting; not a claim that the book has been commercially released.' },
  { id: 'T02', title: 'Explain why the chicken was omitted', owner: 'Kenneth', kind: 'Transcript', status: 'Answered', due: '', priority: 'Normal', topic: 'Final discussion', source: 'Transcript 15 Oct 00:54:26, 00:57:19–00:57:35, 00:58:53–00:59:22', evidence: 'Jackson asked for the reasoning, explicitly saying he was not alleging a mistake. At 00:58:53 he read an explanation beginning “there was no special reason to remove it”. The rest of that automatic transcription is partly garbled.', acceptance: 'The explanation was heard and acknowledged. No promise to add a chicken or remake the book is recorded.', notes: 'Kenneth facilitated the AI response. Do not interpret text read aloud from the AI as a new commitment by Jackson.' },
  { id: 'T03', title: 'Clarify credits and the proposed commercial use', owner: '', kind: 'Transcript', status: 'Unconfirmed', due: '', priority: 'Normal', topic: 'Final discussion', source: 'Transcript 15 Oct 00:44:31–00:45:50, 00:47:31–00:48:58, 00:53:00–00:54:14; V2 p. 14', evidence: 'Participants questioned the credits, discussed selling the book, and asked about implications. The transcript does not capture a clear final legal conclusion or approved sale.', acceptance: 'Record the intended use and confirm attribution and change disclosure against the actual source license. Retain required credits; do not infer permission from casual discussion.', notes: '' },
];

// Keep the summary’s wording as evidence while adding the fuller transcript context.
Object.assign(initialActions[0], { source: 'Summary → Next steps / Kenneth; transcript 22:36:49, 23:02:53–23:03:07, 23:05:44', notes: 'Summary-assigned action. The transcript supports the access request; it does not establish delivery of the extension URL.' });
Object.assign(initialActions[1], { source: 'Summary → Next steps / Kenneth; transcript 23:07:04–23:07:25, 23:09:04', notes: 'Integration described as incomplete. No completion date was agreed.' });
Object.assign(initialActions[2], { source: 'Summary → Next steps / Kenneth; transcript 15 Oct 00:30:58–00:33:01', notes: 'Kenneth explicitly said the tutorial was not yet published during this meeting. No later completion evidence is supplied.' });
Object.assign(initialActions[3], { source: 'Summary → Next steps / Lee; transcript 15 Oct 00:31:05–00:32:40', notes: 'The requested test includes the tutorial and provided ZIP assets. Publication is a dependency; no test result is recorded.' });
Object.assign(initialActions[4], { status: 'Discussed', source: 'Summary → Next steps / Jackson; transcript 23:40:22–23:43:25, 23:55:02–23:55:56, 15 Oct 00:59:39', notes: 'The full transcript already contains concrete use cases. Prioritizing a pilot is a proposed next step, not a recorded agreement.' });

export const reconciliation = [
  { title: 'The omission was explained before the call ended.', detail: 'The summary leaves the chicken discussion open. The transcript captures the explanation and Jackson’s acknowledgment. Its garbled wording is preserved rather than silently repaired.', time: '00:58:53' },
  { title: 'Copyright and the chicken were separate questions.', detail: 'The conversation about credits and selling the book precedes the recurring-chicken question. No clear evidence says copyright required removing the chicken.', time: '00:53:00' },
  { title: 'V2 was shown and discussed during the meeting.', detail: 'Kenneth described the revised book as 14 pages. Jackson then noticed different artwork. The revision is demonstrated; final release approval is not.', time: '00:46:21' },
  { title: 'The repeated-image criticism was about the book.', detail: 'Jackson pointed out the missing-basket scene still showing a basket and said important moments deserved individual artwork. The short summary places this in the game-development section.', time: '00:26:33' },
  { title: 'Jackson already had practical assistant use cases.', detail: 'His requirements include retrieving documents, summarizing appendices, searching a subscribed case database, and filling forms. The final exchange returns to his assistant plans.', time: '23:40:22' },
];

export const timeline = [
  ['22:33:15','Joining & transcription','Setup and multilingual transcription; the file starts after the 22:05 time in its name.'],
  ['22:36:16','Casino AI demonstration','Pattern analysis, supervised learning, and discussion of the system’s limitations.'],
  ['23:03:22','Voice, avatars & 3D workflows','Voice demo, missing audio loopback, unfinished integration, and programmable assets.'],
  ['23:25:37','Image conversion','Photo conversion and file-location issues; the result was displayed.'],
  ['23:40:22','Document assistant needs','Retrieval, appendices, translation, and finding a source story.'],
  ['23:51:26','Cinematic adaptation request','Malay summary followed by Hollywood-style narrative and a new illustrated PDF.'],
  ['23:55:02','Case search & access boundaries','Subscribed database access and security were discussed; no implementation approved.'],
  ['00:02:26','Informal discussion','Workplace and AI anecdotes; not verified factual guidance or assigned work.'],
  ['00:08:43','Game education platform','Character and asset generation, mechanics, tutorial workflow, and learning checks.'],
  ['00:21:54','First storybook review','Repeated images and narrative/illustration mismatch trigger a revision.'],
  ['00:30:58','Tutorial publication & testing','Kenneth says it is unpublished and asks Lee to test the steps and ZIP assets.'],
  ['00:33:30','Game site identity & AI behavior','Passing-off concerns about the game site are separate from the storybook license.'],
  ['00:44:15','V2 review & source credits','The 14-page revision is shown; credits, source context, and possible sale are discussed.'],
  ['00:51:37','The chicken question','Jackson seeks the omission’s rationale; an explanation is read at 00:58:53.'],
  ['00:59:34','Assistant plans & goodbye','Jackson says he already has a use case in mind. Last recorded utterance: 00:59:55.'],
];

export const documentMeta = {
  original: { title: '奶奶的香蕉', subtitle: 'Original story', language: 'Chinese', pages: 12, label: 'Original', description: 'The illustrated source story by Ursula Nafula, with illustrations by Catherine Groenewald and translation by Vicky Liu.' },
  v1: { title: 'Rahsia Pisang Nenek', subtitle: 'Cinematic adaptation · V1', language: 'Malay', pages: 12, label: 'Version 1', description: 'The first cinematic edition. Adds Amina’s name, dialogue, confession, and an epilogue; several scene illustrations repeat.' },
  v2: { title: 'Rahsia Pisang Nenek', subtitle: 'Cinematic adaptation · V2', language: 'Malay', pages: 14, label: 'Version 2', description: 'The revised edition adds a lie, a market encounter, and a clearer repair of trust, with distinct illustrations across its 11 scenes.' },
};

export const findings = [
  { label: 'Confirmed in source', tone: 'green', title: 'The chicken is a visual character.', detail: 'The original PDF shows a chicken repeatedly, including pages 4–8 and 10–11. Its extracted Chinese story text does not name a chicken. A text-only comparison would miss this detail.', refs: [['original',4],['original',8],['original',10]] },
  { label: 'Explained in transcript', tone: 'blue', title: 'The omission was not a recorded copyright requirement.', detail: 'At 00:58:53 Jackson reads an explanation: no special reason for removal; the chicken was not specified as a recurring image element. The middle of the transcription is garbled. V2 p. 3 mentions ayam once, but no chicken was identified in the rendered adaptation artwork.', refs: [['v2',3],['v2',4],['v1',4]], time: '00:58:53' },
  { label: 'Evidence available', tone: 'green', title: 'Credits and license details are already present.', detail: 'The original and both adaptations identify the author, original illustrator, Chinese translator, and CC BY 3.0. The adaptations also disclose new text and AI-generated artwork. The minutes’ copyright explanation remains an unverified explanation for the omission.', refs: [['original',12],['v1',12],['v2',14]] },
  { label: 'Reviewed in meeting', tone: 'green', title: 'V2 addresses the repeated-artwork concern.', detail: 'V1 repeats main illustrations on pp. 3, 4 and 8; 5 and 6; and 9 and 10. V2 has distinct main illustrations on pp. 3–13. At 00:46:21 Jackson notices a different picture. This supports in-meeting review, not formal release approval.', refs: [['v1',3],['v1',4],['v2',4],['v2',9]], time: '00:46:21' },
];
