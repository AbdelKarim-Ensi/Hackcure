export default function CrtAbout() {
  return (
    <section className="flex flex-col items-center gap-5 rounded-2xl border border-line bg-serum p-5 text-center sm:flex-row sm:text-left">
      <img
        src="/crt-logo.jpeg"
        alt="Logo du Croissant-Rouge Tunisien"
        className="h-24 w-24 shrink-0 rounded-xl object-contain"
      />
      <div className="space-y-2">
        <h2 className="font-display text-xl font-semibold">À propos du Croissant-Rouge Tunisien</h2>
        <p className="text-muted">
          Le Croissant-Rouge Tunisien (CRT) est une organisation humanitaire
          nationale, portée par ses bénévoles, qui agit pour la solidarité,
          la santé et le secours aux populations.
        </p>
        <p className="text-muted">
          Avec Damm, annoncez vos collectes de don volontaire et mobilisez
          les donneurs pour répondre aux besoins en sang des hôpitaux.
        </p>
      </div>
    </section>
  )
}
