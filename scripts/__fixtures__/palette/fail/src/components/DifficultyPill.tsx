export function DifficultyPill() {
  // Difficulty must never wear a reserved colour, and never a raw hex.
  return (
    <span className="bg-correct-100 text-correct-700" style={{ borderColor: '#1a8a55' }}>
      3 pt
    </span>
  );
}
