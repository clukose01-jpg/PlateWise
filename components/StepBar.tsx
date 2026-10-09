const STEPS = ["Your kitchen", "Your family", "Your plan"];

export default function StepBar({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="stepbar">
      <div className="stepbar-tracks" aria-hidden="true">
        {STEPS.map((label, i) => (
          <span key={label} className={i < step ? "on" : ""} />
        ))}
      </div>
      <p>
        Step {step} of 3 · {STEPS[step - 1]}
      </p>
    </div>
  );
}
