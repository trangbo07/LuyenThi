export default function Home() {
  return (
    <div className="card text-center" style={{ padding: '4rem 2rem' }}>
      <h1>Welcome to Exam System Pro</h1>
      <p className="text-muted mb-4">Manage your question bank, import via OCR, and generate random exams dynamically.</p>
      <div className="flex justify-center gap-4 mt-4">
        <button className="btn btn-primary">Get Started</button>
      </div>
    </div>
  );
}
