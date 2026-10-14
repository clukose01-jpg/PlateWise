import type { Metadata } from "next";
import AccountBadge from "@/components/AccountBadge";
import { Logo } from "@/components/Illustrations";
import TabBar from "@/components/TabBar";

export const metadata: Metadata = {
  title: "What we save and why · PlateWise",
};

// The privacy note, in plain words. Keep it in step with what the app actually saves.
export default function PrivacyPage() {
  return (
    <main>
      <header>
        <Logo />
        <AccountBadge />
        <h1 className="plan-title">What we save and why</h1>
        <p className="tagline">
          PlateWise is a small app made by one person and still being tested with families. Here&apos;s exactly what
          it saves, in plain words. Last updated October 14, 2026.
        </p>
      </header>

      <article className="privacy">
        <section className="card">
          <h2 className="section-title">What you tell us</h2>
          <ul>
            <li>
              Your family&apos;s answers: how many adults and kids, the kids&apos; first names (you can leave them
              blank) and foods they won&apos;t eat, allergies, how long you cook on weeknights, whether you want
              lunches, and your weekly grocery budget.
            </li>
            <li>What&apos;s in your fridge, freezer and pantry, and food you marked &ldquo;use soon&rdquo;.</li>
            <li>
              What you thought of dinners: thumbs up or down, your notes, and whether you made or skipped each
              dinner, and why.
            </li>
            <li>
              If you make an account: your first name, your email and your password. The password itself is never
              saved, only a scrambled fingerprint of it that can&apos;t be turned back into your password.
            </li>
            <li>Messages you send from the &ldquo;Tell us what you think&rdquo; box, and the email you leave with one.</li>
          </ul>
          <p className="hint">PlateWise is made for parents, not for children to use themselves.</p>
        </section>

        <section className="card">
          <h2 className="section-title">Why we save it</h2>
          <ul>
            <li>
              To make your plans: dinners your family can eat, double-checked for allergies, that learn what your
              family likes. Your pantry and ratings are kept for next week.
            </li>
            <li>To log you in, and keep your things the same on all your devices.</li>
            <li>To send the daily reminder, if you turn it on.</li>
            <li>
              To see roughly how PlateWise is being used, as counts: how many plans, swaps and fridge scans, and in
              which cities. The counts don&apos;t include names or emails.
            </li>
          </ul>
        </section>

        <section className="card">
          <h2 className="section-title">What we don&apos;t do</h2>
          <ul>
            <li>We don&apos;t sell your information, and there are no ads.</li>
            <li>There are no tracking cookies or analytics tools. The only cookie keeps you logged in.</li>
            <li>
              We don&apos;t save your internet address. Your city is looked up from your connection only to count
              families by place and to estimate grocery prices where you live.
            </li>
            <li>Fridge photos are read to list your food, then thrown away. PlateWise doesn&apos;t save them.</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="section-title">Who else handles it</h2>
          <p>PlateWise uses a few services to work:</p>
          <ul>
            <li>
              <strong>Anthropic&apos;s Claude AI</strong> makes your plan and reads your fridge photos. It gets your
              family&apos;s answers (including the kids&apos; first names, if you gave them), your food lists,
              photos and ratings. It doesn&apos;t get your name, email or password.
            </li>
            <li>
              <strong>Vercel</strong> runs the app and stores what&apos;s saved, privately.
            </li>
            <li>
              <strong>Gmail</strong> sends your login codes, so it gets your email address.
            </li>
            <li>
              <strong>Apple, Google or Mozilla</strong> deliver reminders to your phone, if you turn them on.
            </li>
          </ul>
        </section>

        <section className="card">
          <h2 className="section-title">Who can see it</h2>
          <ul>
            <li>
              Anyone with your plan&apos;s link can open it, like someone you shared it with. Plan links are long
              and random, so they can&apos;t be guessed.
            </li>
            <li>
              The PlateWise admin can look at what&apos;s saved to keep the app running and fix problems, and
              reads the messages you send.
            </li>
          </ul>
        </section>

        <section className="card">
          <h2 className="section-title">Where it&apos;s kept, and for how long</h2>
          <ul>
            <li>
              On your device: your answers, pantry, ratings and list of plans, so the app works without an
              account.
            </li>
            <li>
              In PlateWise&apos;s private storage: your plans, and your account if you made one, until you delete
              them. Reminder sign-ups are kept until you turn reminders off. Login codes stop working after 10
              minutes.
            </li>
          </ul>
        </section>

        <section className="card">
          <h2 className="section-title">Deleting your information</h2>
          <ul>
            <li>
              <strong>With an account:</strong> on your Profile, under Your account, tap &ldquo;Delete my
              account&rdquo;. It deletes your account, name and email, your saved answers and ratings, every plan
              you made (for anyone you shared it with too), and the messages you sent. Only the anonymous counts
              stay.
            </li>
            <li>
              <strong>Without an account:</strong> tap &ldquo;Delete this plan&rdquo; at the bottom of a plan&apos;s
              Week tab, and &ldquo;Turn off reminders&rdquo; on your Profile. Everything else is only on your device,
              and clearing this site&apos;s data in your browser settings removes it.
            </li>
          </ul>
        </section>

        <section className="card">
          <h2 className="section-title">Questions</h2>
          <p>
            Use the &ldquo;Tell us what you think&rdquo; box on your Profile, and leave your email if you&apos;d like
            an answer.
          </p>
        </section>
      </article>

      <TabBar active="more" />
    </main>
  );
}
