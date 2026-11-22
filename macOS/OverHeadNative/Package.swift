// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OverHeadNative",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "OverHead", targets: ["OverHeadNative"])],
    targets: [
        .executableTarget(
            name: "OverHeadNative",
            path: "Sources/OverHeadNative"
        )
    ]
)
