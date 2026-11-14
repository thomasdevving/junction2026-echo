import Foundation

/// Every sentence the phone can be expected to say for a recipe, built with the same functions
/// that build the spoken lines at runtime (`LensScreen.spokenText`, `LensScreen.sentence`), so a
/// pre-rendered ElevenLabs line matches what the app asks to speak word for word.
///
/// Not covered (they fall back to iOS speech): sentences Gemini writes itself in `/check` and
/// `/watch` answers when they differ from the recipe's own lines, and error notices built from
/// server messages.
enum VoicePhrases {
    /// Lines that do not depend on the recipe.
    static let fixed: [String] = [
        LensScreen.checking(placeholderCard).spokenText,
        LensScreen.pass(headline: "Looks right").spokenText,
        "That looks right.",
        "That looks right. On to the next step.",
        LensScreen.unsure(headline: "Can't tell", hint: "Look at the board").spokenText,
        LensScreen.unsure(headline: "Can't tell", hint: "").spokenText,
        LensScreen.showMe(placeholderCard).spokenText,
        LensScreen.done(nil).spokenText,
        LensScreen.notice("No connection").spokenText,
        LensScreen.notice("Can't check right now").spokenText,
        LensScreen.notice("Camera off").spokenText,
        LensScreen.notice("Camera not ready").spokenText,
        LensScreen.notice("Choose a recipe").spokenText,
        LensScreen.notice("Preparing…").spokenText,
        "Glasses disconnected.",
        "Glasses connected.",
        // Settings → Voice → Test Voice.
        "Filling piled up. Spread it to the edges.",
    ].compactMap { $0 }

    /// The fixed lines plus everything tied to this recipe's steps.
    static func lines(for recipe: Recipe) -> [String] {
        let total = recipe.steps.count
        var lines = fixed
        lines.append(LensScreen.notice("Preparing \(total) steps…").spokenText ?? "")
        for step in recipe.steps {
            let card = StepCard(
                idx: step.idx, total: total, title: step.title, keyLine: step.keyLine, refImage: nil,
                watching: .off)
            lines.append(LensScreen.step(card).spokenText ?? "")
            // "Say that again" reads the full instruction (CookSession).
            lines.append(step.instruction.isEmpty ? step.keyLine : step.instruction)
            // Audio-only narration after a fix / can't-tell / notice (Resilience).
            lines.append("Back to step \(step.idx). \(LensScreen.sentence(step.keyLine))")
            for mistake in step.watchFors {
                // What the server's `spoken` is for a known mistake, and the lens fallback.
                lines.append(mistake.spoken)
                lines.append(
                    LensScreen.fix(card, headline: mistake.headline, fix: mistake.fix, proactive: false).spokenText ?? "")
            }
            if let timer = step.timerS {
                lines.append(LensScreen.timer(remainingS: timer, card).spokenText ?? "")
            }
        }
        // The Done screen for this recipe: every first-time / fixes combination.
        for first in 0...total {
            for fixes in 0...total {
                let summary = SessionSummary(
                    stepsTotal: total, stepsPassedFirstTry: first, fixesCaught: fixes, warnings: 0, questions: 0)
                lines.append(LensScreen.done(summary).spokenText ?? "")
            }
        }
        // Keep the first spelling of each line; drop empties and duplicates by lookup key.
        var seen = Set<String>()
        return lines
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && seen.insert(VoiceLibrary.key($0)).inserted }
    }

    private static let placeholderCard = StepCard(
        idx: 1, total: 1, title: "", keyLine: "", refImage: nil, watching: .off)
}
