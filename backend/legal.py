"""Public legal pages the app stores require: privacy policy, terms, account deletion.

Served as plain HTML so they work as store listing URLs. Set SUPPORT_EMAIL in the
environment to show a contact address.
"""
import html
import os
from datetime import date

UPDATED = date(2026, 10, 6).strftime("%-d %B %Y")


def _contact() -> str:
    email = os.getenv("SUPPORT_EMAIL", "").strip()
    if email:
        e = html.escape(email)
        return f'Email us at <a href="mailto:{e}">{e}</a>.'
    return "Contact us at the support email shown on our App Store or Google Play listing."


def _page(title: str, body: str) -> str:
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} · AstroNow</title>
<style>
:root{{color-scheme:dark}}body{{margin:0;background:#0B0B1A;color:#F8F2E8;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}}
main{{max-width:720px;margin:0 auto;padding:40px 20px 64px}}h1{{font:600 34px/1.2 Georgia,serif;margin:0 0 4px}}
h2{{font:600 20px/1.3 Georgia,serif;margin:32px 0 8px;color:#F7DDA6}}p,li{{color:#D9D4E6}}a{{color:#F2C879}}
.muted{{color:#AAA6BE;font-size:14px}}ul{{padding-left:20px}}
</style></head><body><main><h1>{title}</h1><p class="muted">AstroNow · Last updated {UPDATED}</p>{body}</main></body></html>"""


def privacy() -> str:
    return _page("Privacy Policy", f"""
<p>AstroNow gives you astrology readings based on your birth details. This policy explains what we collect, why, and the choices you have.</p>
<h2>What we collect</h2>
<ul>
<li><b>Account details:</b> your mobile number or email address, and your first name.</li>
<li><b>Birth details:</b> date, time and place of birth for you and any family profiles you add. We use these only to calculate charts and readings.</li>
<li><b>Questions and conversations</b> you send to the 24x7 Astrologer, and reports you unlock, so you can see them again.</li>
<li><b>Purchases:</b> subscription and purchase status from the App Store or Google Play. We never see your card details.</li>
<li><b>Basic usage events</b> (for example, which screens are opened) to improve the app. We do not sell this data or use it for third-party advertising.</li>
</ul>
<h2>How we use it</h2>
<p>To create your account, calculate your chart, write your readings and reports, answer your questions, send the reminders you turn on, and keep the service secure (for example, limiting how many sign-in codes can be requested).</p>
<h2>Who processes it for us</h2>
<ul>
<li>Supabase: account sign-in and database hosting.</li>
<li>Vercel: hosting for our servers.</li>
<li>OpenRouter and the AI model providers it routes to: writing readings and answers. We send your chart details and your question, not your phone number or email.</li>
<li>Message Central: sending sign-in codes by SMS.</li>
<li>RevenueCat, Apple and Google: managing purchases and subscriptions.</li>
<li>Google Places: finding your birthplace as you type.</li>
</ul>
<h2>How long we keep it</h2>
<p>We keep your data while your account is open. When you delete your account, we delete your profile, charts, family profiles, conversations and saved readings. Purchase records may be kept where the law requires.</p>
<h2>Your choices</h2>
<ul>
<li>Edit your birth details and profile in the app at any time.</li>
<li>Delete your account in the app: Profile, then Delete my account. Or see <a href="/delete-account">how to delete your account</a>.</li>
<li>Turn reminders off in the app or in your phone's settings.</li>
</ul>
<h2>Children</h2>
<p>AstroNow is not meant for children under 13, and we do not knowingly collect their data.</p>
<h2>Readings are guidance</h2>
<p>Astrology readings are for reflection and entertainment. They are not medical, legal or financial advice.</p>
<h2>Contact</h2>
<p>{_contact()}</p>
""")


def terms() -> str:
    return _page("Terms of Use", f"""
<p>By using AstroNow you agree to these terms.</p>
<h2>The service</h2>
<p>AstroNow provides astrology charts, readings, reports and a 24x7 Astrologer that answers your questions. Readings are for guidance and entertainment only. They are not a substitute for professional medical, legal, financial or psychological advice, and you are responsible for your own decisions.</p>
<h2>Your account</h2>
<p>Keep your sign-in details secure. One account per person; you may not create accounts to get around limits. You must be at least 13 years old.</p>
<h2>Subscriptions and purchases</h2>
<p>AstroNow Plus is an auto-renewing subscription billed through the App Store or Google Play. It renews unless you cancel at least 24 hours before the end of the current period. Manage or cancel it in your store account settings. Question packs and reports are one-time purchases. Refunds are handled by Apple or Google under their policies. Plus includes fair-use limits on daily questions to keep the service available for everyone.</p>
<h2>Acceptable use</h2>
<p>Do not misuse the service, try to break or overload it, or use it to harass anyone. We may suspend accounts that do.</p>
<h2>Changes</h2>
<p>We may update the app and these terms. If a change is significant we will let you know in the app.</p>
<h2>Contact</h2>
<p>{_contact()}</p>
""")


def delete_account() -> str:
    return _page("Delete your account", f"""
<p>You can delete your AstroNow account and its data at any time.</p>
<h2>In the app</h2>
<ol><li>Open AstroNow and sign in.</li><li>Go to <b>Profile</b>.</li><li>Tap <b>Delete my account</b>, then tap again to confirm.</li></ol>
<p>This permanently deletes your profile, birth details, charts, family profiles, conversations and saved readings.</p>
<h2>Can't open the app?</h2>
<p>{_contact()} Send the mobile number or email on the account and we will delete it within 30 days.</p>
<h2>Subscriptions</h2>
<p>Deleting your account does not cancel a store subscription. Cancel it in your App Store or Google Play subscription settings.</p>
""")
