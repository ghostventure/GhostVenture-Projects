import AppKit
import Foundation
import PDFKit

let arguments = Array(CommandLine.arguments.suffix(2))
guard arguments.count == 2 else {
    fputs("Usage: render-overhead-guide.swift <source.md> <output.pdf>\n", stderr)
    exit(2)
}

let sourceURL = URL(fileURLWithPath: arguments[0])
let outputURL = URL(fileURLWithPath: arguments[1])
let source = try String(contentsOf: sourceURL, encoding: .utf8)
let pages = source.components(separatedBy: "---PAGE---").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
let app = NSApplication.shared
app.setActivationPolicy(.prohibited)

let navy = NSColor(calibratedRed: 23 / 255, green: 36 / 255, blue: 59 / 255, alpha: 1)
let violet = NSColor(calibratedRed: 129 / 255, green: 113 / 255, blue: 1, alpha: 1)
let muted = NSColor(calibratedRed: 83 / 255, green: 98 / 255, blue: 122 / 255, alpha: 1)

func replaceInlineMarkup(_ input: String) -> (String, [NSRange]) {
    var text = input
    var boldRanges: [NSRange] = []
    let linkPattern = #"\[([^\]]+)\]\(([^)]+)\)"#
    if let regex = try? NSRegularExpression(pattern: linkPattern) {
        let nsText = text as NSString
        for match in regex.matches(in: text, range: NSRange(location: 0, length: nsText.length)).reversed() {
            let label = nsText.substring(with: match.range(at: 1))
            text = (text as NSString).replacingCharacters(in: match.range, with: label)
        }
    }
    let boldPattern = #"\*\*(.+?)\*\*"#
    if let regex = try? NSRegularExpression(pattern: boldPattern) {
        let nsText = text as NSString
        for match in regex.matches(in: text, range: NSRange(location: 0, length: nsText.length)).reversed() {
            let value = nsText.substring(with: match.range(at: 1))
            text = (text as NSString).replacingCharacters(in: match.range, with: value)
        }
        let clean = text as NSString
        for match in regex.matches(in: input, range: NSRange(location: 0, length: (input as NSString).length)) {
            let sourceText = input as NSString
            let value = sourceText.substring(with: match.range(at: 1))
            let range = clean.range(of: value)
            if range.location != NSNotFound { boldRanges.append(range) }
        }
    }
    text = text.replacingOccurrences(of: "`", with: "")
    return (text, boldRanges)
}

func makePage(_ markdown: String, number: Int) -> Data {
    let textView = NSTextView(frame: NSRect(x: 0, y: 0, width: 612, height: 792))
    textView.isEditable = false
    textView.isSelectable = false
    textView.drawsBackground = true
    textView.backgroundColor = .white
    textView.textContainerInset = NSSize(width: 52, height: 45)
    textView.isVerticallyResizable = false
    textView.isHorizontallyResizable = false
    textView.maxSize = NSSize(width: 612, height: 792)
    textView.textContainer?.containerSize = NSSize(width: 508, height: 700)
    textView.textContainer?.widthTracksTextView = false
    textView.textContainer?.heightTracksTextView = false

    let output = NSMutableAttributedString()
    let brand = NSMutableParagraphStyle()
    brand.paragraphSpacing = 15
    let brandText = NSAttributedString(string: "OVERHEAD   /   BUSINESS OPERATIONS\n", attributes: [
        .font: NSFont.systemFont(ofSize: 8, weight: .bold), .foregroundColor: violet,
        .kern: 1.6, .paragraphStyle: brand
    ])
    output.append(brandText)

    for (lineIndex, rawLine) in markdown.components(separatedBy: .newlines).enumerated() {
        let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
        if line.isEmpty { continue }
        if line == "---" { continue }

        let headingLevel = line.prefix(while: { $0 == "#" }).count
        let prefix = headingLevel > 0 ? String(repeating: "#", count: headingLevel) + " " : ""
        let content = headingLevel > 0 ? String(line.dropFirst(prefix.count)) : line
        let isQuote = content.hasPrefix("> ")
        let isList = content.hasPrefix("- ")
        let sourceText = isQuote ? String(content.dropFirst(2)) : isList ? "•  " + String(content.dropFirst(2)) : content
        let (cleanText, boldRanges) = replaceInlineMarkup(sourceText)

        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = 2.1
        paragraph.paragraphSpacing = isList ? 4 : 7
        if headingLevel == 1 {
            paragraph.paragraphSpacingBefore = lineIndex == 0 ? 0 : 5
            paragraph.paragraphSpacing = 13
        } else if headingLevel == 2 {
            paragraph.paragraphSpacingBefore = 5
            paragraph.paragraphSpacing = 6
        }
        let font: NSFont
        let color: NSColor
        if headingLevel == 1 {
            font = .systemFont(ofSize: 22, weight: .bold); color = navy
        } else if headingLevel == 2 {
            font = .systemFont(ofSize: 13.5, weight: .bold); color = navy
        } else if isQuote {
            font = .systemFont(ofSize: 9.5, weight: .medium); color = muted
        } else {
            font = .systemFont(ofSize: 9.4, weight: .regular); color = NSColor(calibratedRed: 35 / 255, green: 45 / 255, blue: 61 / 255, alpha: 1)
        }
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .paragraphStyle: paragraph]
        let attributed = NSMutableAttributedString(string: cleanText + "\n", attributes: attributes)
        for range in boldRanges where range.location + range.length <= (cleanText as NSString).length {
            attributed.addAttribute(.font, value: NSFont.systemFont(ofSize: headingLevel > 0 ? (headingLevel == 1 ? 22 : 13.5) : 9.4, weight: .bold), range: range)
        }
        if isQuote { attributed.addAttribute(.backgroundColor, value: NSColor(calibratedRed: 0.95, green: 0.95, blue: 1, alpha: 1), range: NSRange(location: 0, length: (cleanText as NSString).length)) }
        output.append(attributed)
    }

    textView.textStorage?.setAttributedString(output)
    return textView.dataWithPDF(inside: textView.bounds)
}

let combined = PDFDocument()
for (index, markdown) in pages.enumerated() {
    let data = makePage(markdown, number: index + 1)
    guard let document = PDFDocument(data: data), document.pageCount > 0, let page = document.page(at: 0) else {
        throw NSError(domain: "OverHeadGuide", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not render guide page \(index + 1)."])
    }
    combined.insert(page, at: combined.pageCount)
}
guard combined.write(to: outputURL) else {
    throw NSError(domain: "OverHeadGuide", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not write the user guide PDF."])
}
print("Rendered \(combined.pageCount) pages to \(outputURL.path)")
