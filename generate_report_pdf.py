import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 11 * inch - 36, "LEAD INTAKE & TRIAGE DESK — COMMERCIAL BLUEPRINT & SALES REPORT")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(54, 11 * inch - 42, 8.5 * inch - 54, 11 * inch - 42)
            
        # Footer
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 45, 8.5 * inch - 54, 45)
        self.drawString(54, 32, "CONFIDENTIAL & PROPRIETARY — PREPARED FOR CLIENT ENGAGEMENT")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 54, 32, page_str)
        self.restoreState()

def build_pdf(filename="CRM_Sales_Pitch_and_Solution_Blueprint.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom styles
    brand_primary = colors.HexColor("#1B4332")   # Deep forest green
    brand_dark = colors.HexColor("#0F172A")      # Slate 900
    brand_muted = colors.HexColor("#475569")     # Slate 600
    brand_bg_light = colors.HexColor("#F8FAFC")  # Slate 50
    brand_accent = colors.HexColor("#D97706")    # Amber 600

    title_style = ParagraphStyle(
        'DocTitle',
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=brand_dark,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=brand_muted,
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=brand_primary,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=brand_dark,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1E293B"),
        leftIndent=14,
        spaceAfter=3
    )

    quote_style = ParagraphStyle(
        'Quote_Custom',
        fontName='Helvetica-Oblique',
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#065F46"),
        spaceAfter=6
    )

    script_speaker = ParagraphStyle(
        'ScriptSpeaker',
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=brand_primary,
        spaceBefore=8,
        spaceAfter=2,
        keepWithNext=True
    )

    script_cue = ParagraphStyle(
        'ScriptCue',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#B45309"),
        spaceAfter=3
    )

    script_dialogue = ParagraphStyle(
        'ScriptDialogue',
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=6
    )

    story = []

    # Title Banner
    story.append(Paragraph("LEAD INTAKE & TRIAGE DESK", title_style))
    story.append(Paragraph("High-Ticket Client Acquisition Blueprint, Architecture & 2-Minute Sales Pitch", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=brand_primary, spaceBefore=0, spaceAfter=14))

    # Executive Summary Card
    exec_text = (
        "<b>EXECUTIVE OVERVIEW:</b> This document details the exact business opportunity, market problem, "
        "operational solution, feature architecture, pricing models, and complete word-for-word sales script "
        "for the <b>Lead Qualification & Triage Desk</b> built for executive coaches, leadership trainers, "
        "and high-ticket advisory firms."
    )
    exec_table = Table([[Paragraph(exec_text, body_style)]], colWidths=[7.0 * inch])
    exec_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(exec_table)
    story.append(Spacer(1, 12))

    # SECTION 1: THE REAL PROBLEM
    story.append(Paragraph("1. The Core Client Problem (The Silent $50,000 Revenue Leak)", h1_style))
    story.append(Paragraph(
        "Executive coaches, leadership development consultants, and corporate advisory practices "
        "charge premium rates ($5,000 to $50,000+ per engagement). However, their operational intake "
        "process is severely broken, creating four acute operational bottlenecks:",
        body_style
    ))

    problems = [
        ("Post-Session Mental Exhaustion:", "Coaches finish 3-4 consecutive high-intensity 60-minute coaching sessions. They are mentally drained. When they open their inbox, seeing 3 lengthy prospect inquiries fills them with dread rather than excitement."),
        ("The Deadly 3-Day Triage Delay:", "Because reading multi-paragraph essays and evaluating organizational fit requires deep focus, inquiries sit unanswered for 48 to 72 hours. High-ranking executives and HR Directors do not wait; they interview competitor firms within 24 hours."),
        ("No Separation of Urgent vs. Vague Leads:", "A prospect with budget wanting immediate 30-person manager training gets lost next to someone browsing for general advice. High-margin opportunities are buried under low-ticket noise."),
        ("The AI Automation Fear:", "Practitioners refuse generic AI auto-responders or autonomous chatbots because a single hallucinated answer or clumsy bot reply permanently incinerates a six-figure corporate relationship.")
    ]
    for title, desc in problems:
        story.append(Paragraph(f"• <b>{title}</b> {desc}", bullet_style))

    story.append(Spacer(1, 10))

    # SECTION 2: THE SYSTEM SOLUTION
    story.append(Paragraph("2. The Turnkey Solution: Executive Lead Triage Desk", h1_style))
    story.append(Paragraph(
        "Rather than an invasive CRM overhaul or risky autonomous bot, the system acts as a "
        "<b>discrete, internal Chief of Staff</b> that processes incoming traffic before the human looks at it:",
        body_style
    ))

    solutions = [
        ("High-Trust Intake Gateway (/inquire):", "A clean, executive-grade inquiry form capturing role, organization, team size, service interest, timeline urgency, and specific challenge statement with spam defense and duplicate-submission blocking."),
        ("Intelligent Triage Engine:", "Synthesizes raw unstructured inquiries into a concise 2-sentence executive summary, extracts grounded proof quotes, and pinpoints missing scoping items."),
        ("Deterministic 0–8 Priority Scoring:", "Computes lead urgency strictly in verified code (timing + matching offer + specific challenge + corporate scope). Never guesses or invents priorities."),
        ("Safety Overrides & Contradiction Detection:", "Automatically flags mismatched signals (e.g. asking for a 500-person keynote while selecting 1:1 coaching) into 'Needs Review'."),
        ("Human-in-the-Loop Pipeline & Draft Desk:", "Provides ready-to-send bespoke email drafts tailored to the lead's exact situation. Outbound transmission is strictly consent-gated and locked until the coach clicks explicit confirmation.")
    ]
    for title, desc in solutions:
        story.append(Paragraph(f"• <b>{title}</b> {desc}", bullet_style))

    story.append(Spacer(1, 10))

    # SECTION 3: SYSTEM ARCHITECTURE & FEATURES
    story.append(Paragraph("3. Full Feature & Technical Specifications", h1_style))

    feat_data = [
        [Paragraph("<b>Component</b>", h2_style), Paragraph("<b>Function & Mechanism</b>", h2_style), Paragraph("<b>Client Business Benefit</b>", h2_style)],
        [
            Paragraph("<b>Public Intake (/inquire)</b>", body_style),
            Paragraph("Form validation (Zod), honeypot anti-spam, 10-minute duplicate submission protection, separate consent checkboxes.", body_style),
            Paragraph("Eliminates spam. Projects elite credibility. Establishes legal compliance without scaring prospects.", body_style)
        ],
        [
            Paragraph("<b>Qualification Engine</b>", body_style),
            Paragraph("OpenRouter / GPT-4o-mini / Claude adapter with strict JSON output schema. Seamless offline mock fallback when offline.", body_style),
            Paragraph("Gives the coach an instant briefing in 5 seconds. Zero reliance on expensive, fragile external dependencies.", body_style)
        ],
        [
            Paragraph("<b>Deterministic Scoring</b>", body_style),
            Paragraph("0 to 8 points strictly computed in code. Timing 'Now' (+2), Offer Match (+2), Challenge Specific (+1), Corporate (+2).", body_style),
            Paragraph("Transparent, bias-free ranking. The coach immediately knows who can buy today without second-guessing.", body_style)
        ],
        [
            Paragraph("<b>9-Stage Kanban Board</b>", body_style),
            Paragraph("Stages: New Inquiry -> Needs Review -> Qualified -> Contacted -> Call Booked -> Offer Sent -> Won -> Lost -> Not a Fit.", body_style),
            Paragraph("Total clarity over pipeline health. AI is strictly forbidden from moving stages—human retains 100% control.", body_style)
        ],
        [
            Paragraph("<b>Consent Email Desk</b>", body_style),
            Paragraph("Template synthesis matching route + lead parameters. Physical send-lock until human ticks confirmation.", body_style),
            Paragraph("Lets the coach reply in 15 seconds with personalized nuance without fear of embarrassing bot mistakes.", body_style)
        ],
        [
            Paragraph("<b>White-Label Settings</b>", body_style),
            Paragraph("Dynamically editable business name, hex color palette, service offers, and booking calendar placeholder.", body_style),
            Paragraph("Turnkey rebrandable in under 5 minutes for any coaching or advisory client.", body_style)
        ]
    ]

    t = Table(feat_data, colWidths=[1.8 * inch, 2.7 * inch, 2.5 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(t)

    # Page Break for Clean Sales Pitch & Pricing
    story.append(PageBreak())

    # SECTION 4: PRICING & ROI
    story.append(Paragraph("4. Commercial Pricing Framework & Client ROI", h1_style))
    story.append(Paragraph(
        "Never price this solution on your technical build costs (which run under $0.50/month on OpenRouter). "
        "<b>Anchor your pricing directly to the value of their client engagements:</b>",
        body_style
    ))

    pricing_data = [
        [Paragraph("<b>Package</b>", h2_style), Paragraph("<b>Price Point</b>", h2_style), Paragraph("<b>Deliverables & Scope</b>", h2_style)],
        [
            Paragraph("<b>Turnkey Setup & Retainer (Recommended)</b>", body_style),
            Paragraph("<b>$3,500 setup</b><br/>+ <b>$297 / month</b>", body_style),
            Paragraph("Complete branding customization, offer calibration, domain setup, assistant onboarding call, monthly maintenance & uptime support.", body_style)
        ],
        [
            Paragraph("<b>Executive DFY Enterprise Setup</b>", body_style),
            Paragraph("<b>$5,500 – $7,500</b><br/>flat fee", body_style),
            Paragraph("Includes Make.com webhook integrations into Slack/Calendly, custom routing logic, and 60 days priority operational support.", body_style)
        ],
        [
            Paragraph("<b>Fast Pilot Offer (First 2 Clients)</b>", body_style),
            Paragraph("<b>$1,500 setup</b><br/>+ <b>$199 / month</b>", body_style),
            Paragraph("Fast 48-hour deployment in exchange for video testimonial and verified operational case study.", body_style)
        ]
    ]

    pt = Table(pricing_data, colWidths=[2.0 * inch, 1.8 * inch, 3.2 * inch])
    pt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(pt)
    story.append(Spacer(1, 10))

    story.append(Paragraph("The Client Closing Math:", h2_style))
    story.append(Paragraph(
        "<i>'What is a single executive retainer worth to you? Between $10,000 and $25,000. "
        "If a prospect submits on Thursday while you're booked in sessions, and sits until Monday, "
        "they've already contacted two other providers. For $3,500 setup, this system pays for itself "
        "three times over the very first time it flags a hot lead and lets you respond in 30 seconds.'</i>",
        quote_style
    ))

    story.append(Spacer(1, 10))

    # SECTION 5: COMPLETE 2-MINUTE VIDEO SCRIPT
    story.append(Paragraph("5. Complete 2-Minute Video Recording Script", h1_style))
    story.append(Paragraph(
        "<b>Format:</b> Screen recording with webcam inset. Total duration: ~120 seconds (approx. 270 words). "
        "Focus on emotional relief, operational calm, and speed-to-revenue.",
        body_style
    ))

    script_blocks = [
        (
            "[0:00 - 0:30] PART 1: THE KNIFE IN THE HEART (CALL OUT EXHAUSTION)",
            "ON-SCREEN: Show the calm CRM Overview Dashboard (http://localhost:3000). Clean, elegant, no chaos.",
            "If you’re running an executive coaching or leadership advisory practice, you know this exact feeling:\n\n"
            "You just wrapped up three intense back-to-back client sessions. You’re mentally drained. You open your inbox or website inquiries, and there are three new people asking for help.\n\n"
            "One wants 1:1 coaching. One wants corporate team training. One wrote an entire life story.\n\n"
            "You simply don't have the bandwidth right now to read through essays, triage them, figure out what they need, or draft thoughtful replies. So they sit there for two days, three days... and by the time you reach out, the deal is cold, or they already hired another firm.\n\n"
            "You’re letting twenty, thirty, fifty thousand dollars in business evaporate—not because you don't know how to coach, but because your intake process is draining your life."
        ),
        (
            "[0:30 - 0:55] PART 2: THE SHIFT (HAND OFF THE MENTAL HEAVY LIFTING)",
            "ON-SCREEN: Switch to the public inquiry form (/inquire). Click '1:1 Coaching (Now)' demo prefill and click 'Submit Inquiry'.",
            "You shouldn't be acting as your own admin clerk between sessions.\n\n"
            "Instead, your prospective client lands on this calm, high-trust intake page. They share their role, their urgency, and their core challenge.\n\n"
            "The moment they submit, all the mental heavy lifting is handled before you even look at the screen.\n\n"
            "The system reads between the lines: it identifies their exact pain point, matches them to your exact service, weeds out people who aren't ready, and ranks them by real buying urgency from zero to eight."
        ),
        (
            "[0:55 - 1:30] PART 3: THE RELIEF (30 SECONDS TO MOVE A DEAL FORWARD)",
            "ON-SCREEN: Switch back to CRM (localhost:3000). Click the new lead at top to slide open the Lead Detail Drawer. Scroll through the summary, score breakdown, and click 'Draft Email'.",
            "Now look at what your workday looks like:\n\n"
            "You open your dashboard between sessions. You don't have to read messy paragraphs.\n\n"
            "Right here, you get a clean executive briefing: who they are, what they need, their priority score, and the exact next step to take.\n\n"
            "And instead of staring at a blank screen trying to figure out what to write, you hit one button. A bespoke, respectful response is ready for you—addressing their specific situation, completely aligned with your voice.\n\n"
            "You review it, confirm it, and send it in ten seconds flat. You look fast, you look high-caliber, and you didn't spend thirty minutes stressing over it."
        ),
        (
            "[1:30 - 1:50] PART 4: THE CONTROL (COMPLETE PEACE OF MIND)",
            "ON-SCREEN: Click 'Pipeline' tab. Show the neat 9-stage Kanban columns. Drag a card forward.",
            "Every single prospect is tracked cleanly from first inquiry to booked call to closed contract.\n\n"
            "Nothing gets lost. Nothing falls through the cracks. And nothing happens behind your back—you stay in complete control of every relationship, without the operational chaos."
        ),
        (
            "[1:50 - 2:05] PART 5: THE CLOSE (SELL THEIR TIME & FOCUS BACK)",
            "ON-SCREEN: Switch to your camera full-screen, or hover over the clean dashboard.",
            "This isn't about software. This is about protecting your focus, saving you five to ten hours of admin stress every week, and turning high-ticket inquiries into paid contracts while you stay in your zone of genius.\n\n"
            "If you want this exact intake and triage engine installed into your coaching practice this week, reach out below. Let’s get your time back."
        )
    ]

    for title, cue, dialogue in script_blocks:
        story.append(Paragraph(title, script_speaker))
        story.append(Paragraph(f"<b>[ACTION]:</b> {cue}", script_cue))
        story.append(Paragraph(dialogue.replace("\n\n", "<br/><br/>"), script_dialogue))
        story.append(Spacer(1, 4))

    doc.build(story, canvasmaker=NumberedCanvas)
    print("PDF build successful:", filename)

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "CRM_Sales_Pitch_and_Solution_Blueprint.pdf"
    build_pdf(out_file)
