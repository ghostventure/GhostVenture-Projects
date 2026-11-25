// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OverHeadNative",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "OverHead", targets: ["OverHeadNative"]),
        .executable(name: "OverHeadBilling", targets: ["OverHeadBilling"]),
        .executable(name: "OverHeadBillingSync", targets: ["OverHeadBillingSync"])
    ],
    targets: [
        .executableTarget(
            name: "OverHeadNative",
            path: "Sources/OverHeadNative"
        ),
        .executableTarget(name: "OverHeadBilling", path: "Sources/OverHeadBilling"),
        .executableTarget(name: "OverHeadBillingSync", path: "Sources/OverHeadBillingSync")
    ]
)
