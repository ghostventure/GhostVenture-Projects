// Ghost Surfer Linux Installation Manager.
// It detects the distro, selects a compatible app release, verifies its hash,
// and delegates the per-user install to the verified Linux package.
package main

import (
	"archive/tar"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const (
	defaultManifest = "https://ghost-surfer-browser.web.app/downloads/installer-manifest.json"
	maxManifest     = 1 << 20
	maxPackage      = 2 << 30
	maxExpanded     = 8 << 30
	maxFiles        = 25000
)

type artifact struct {
	Name   string `json:"name"`
	URL    string `json:"url"`
	SHA256 string `json:"sha256"`
	Format string `json:"format"`
}

type compatibleTarget struct {
	Name            string            `json:"name"`
	DistroIDs       []string          `json:"distroIds"`
	DistroFamilies  []string          `json:"distroFamilies"`
	MinimumVersions map[string]string `json:"minimumVersions"`
	MaximumVersions map[string]string `json:"maximumVersions"`
	MinimumGlibc    string            `json:"minimumGlibc"`
	Fallback        bool              `json:"fallback"`
	Verified        bool              `json:"verified"`
	Warning         string            `json:"warning"`
}

type release struct {
	Version           string             `json:"version"`
	Minimum           map[string]any     `json:"minimum"`
	Tested            map[string]any     `json:"tested"`
	CompatibleTargets []compatibleTarget `json:"compatibleTargets"`
	CompatibilityNote string             `json:"compatibilityNote"`
	Artifact          artifact           `json:"artifact"`
}

type manifest struct {
	SchemaVersion int `json:"schemaVersion"`
	Platforms     map[string]struct {
		Releases []release `json:"releases"`
	} `json:"platforms"`
}

type target struct {
	DistroID      string
	DistroName    string
	DistroVersion string
	DistroLike    []string
	Architecture  string
	LibcName      string
	LibcVersion   string
}

type candidate struct {
	Release  release
	Priority int
	Warning  string
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "Ghost Surfer Manager:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	flags := flag.NewFlagSet("ghost-surfer-manager", flag.ContinueOnError)
	manifestURL := flags.String("manifest", defaultManifest, "HTTPS release catalog URL or local JSON path")
	allowUnverified := flags.Bool("allow-unverified", false, "continue with a Linux target marked unverified")
	removeProfile := flags.Bool("remove-profile", false, "also remove the local browser profile during uninstall")
	if err := flags.Parse(args); err != nil {
		return err
	}
	action := "install"
	if flags.NArg() > 0 {
		action = strings.ToLower(flags.Arg(0))
	}
	if os.Geteuid() == 0 && action != "help" {
		return errors.New("run as your regular user; administrator or sudo access is not required")
	}
	if runtime.GOOS != "linux" {
		return fmt.Errorf("this manager runs on Linux; detected %s", runtime.GOOS)
	}
	system, err := detectTarget()
	if err != nil {
		return err
	}
	switch action {
	case "help", "-h", "--help":
		printHelp()
		return nil
	case "plan":
		return showPlan(*manifestURL, system)
	case "status":
		return showStatus(system)
	case "launch":
		return launchApp()
	case "uninstall":
		return uninstall(*removeProfile)
	case "install", "update", "reinstall":
		return installOrUpdate(action, *manifestURL, system, *allowUnverified)
	default:
		return fmt.Errorf("unknown action %q; run 'ghost-surfer-manager help'", action)
	}
}

func printHelp() {
	fmt.Println(`Ghost Surfer Linux Installation Manager

Usage:
  ghost-surfer-manager [options] [install|update|reinstall|uninstall|status|launch|plan]

With no action, the manager installs Ghost Surfer. It detects the Linux
distribution, release, derivative family, architecture, and glibc version,
then selects and verifies a compatible browser package.

Options:
  --manifest URL|PATH   Release catalog (defaults to the Ghost Surfer site)
  --allow-unverified    Continue after reviewing an unverified-target warning
  --remove-profile      Also delete browser profile data during uninstall

Installations are per user. No sudo or administrator access is needed.`)
}

func detectTarget() (target, error) {
	values, err := readOSRelease()
	if err != nil {
		return target{}, fmt.Errorf("could not identify this Linux distribution: %w", err)
	}
	architecture := runtime.GOARCH
	if architecture == "amd64" {
		architecture = "x86_64"
	} else if architecture == "arm64" {
		architecture = "arm64"
	}
	libcName, libcVersion := detectGlibc()
	return target{
		DistroID:      strings.ToLower(values["ID"]),
		DistroName:    firstNonempty(values["PRETTY_NAME"], values["NAME"], "Unknown Linux distribution"),
		DistroVersion: values["VERSION_ID"],
		DistroLike:    splitLower(values["ID_LIKE"]),
		Architecture:  architecture,
		LibcName:      libcName,
		LibcVersion:   libcVersion,
	}, nil
}

func readOSRelease() (map[string]string, error) {
	for _, name := range []string{"/etc/os-release", "/usr/lib/os-release"} {
		contents, err := os.ReadFile(name)
		if err != nil {
			continue
		}
		return parseOSRelease(string(contents)), nil
	}
	return nil, errors.New("neither /etc/os-release nor /usr/lib/os-release is readable")
}

func parseOSRelease(contents string) map[string]string {
	values := map[string]string{}
	for _, line := range strings.Split(contents, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok || key == "" {
			continue
		}
		value = strings.TrimSpace(value)
		if unquoted, err := strconv.Unquote(value); err == nil {
			value = unquoted
		} else {
			value = strings.Trim(value, "'")
		}
		values[key] = value
	}
	return values
}

func detectGlibc() (string, string) {
	output, err := exec.Command("getconf", "GNU_LIBC_VERSION").Output()
	if err != nil {
		return "", ""
	}
	parts := strings.Fields(string(output))
	if len(parts) >= 2 {
		return strings.ToLower(parts[0]), parts[1]
	}
	return "", ""
}

func displayTarget(system target) string {
	like := "none reported"
	if len(system.DistroLike) > 0 {
		like = strings.Join(system.DistroLike, ", ")
	}
	libc := firstNonempty(strings.TrimSpace(system.LibcName+" "+system.LibcVersion), "unknown")
	return fmt.Sprintf("%s (ID=%s, version=%s; ID_LIKE=%s), %s, %s", system.DistroName, firstNonempty(system.DistroID, "unknown"), firstNonempty(system.DistroVersion, "unknown"), like, system.Architecture, libc)
}

func loadManifest(source string) (manifest, string, error) {
	var body []byte
	baseURL := source
	parsed, parseErr := url.Parse(source)
	if parseErr == nil && (parsed.Scheme == "http" || parsed.Scheme == "https") {
		if parsed.Scheme != "https" {
			return manifest{}, "", errors.New("release catalog must be loaded over HTTPS")
		}
		request, _ := http.NewRequest(http.MethodGet, source, nil)
		request.Header.Set("User-Agent", "GhostSurfer-Linux-Installation-Manager")
		client := &http.Client{Timeout: 20 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if req.URL.Scheme != "https" {
				return errors.New("release catalog redirected away from HTTPS")
			}
			return nil
		}}
		response, err := client.Do(request)
		if err != nil {
			return manifest{}, "", fmt.Errorf("load release catalog: %w", err)
		}
		defer response.Body.Close()
		if response.StatusCode != http.StatusOK {
			return manifest{}, "", fmt.Errorf("release catalog returned HTTP %d", response.StatusCode)
		}
		content, readErr := io.ReadAll(io.LimitReader(response.Body, maxManifest+1))
		if readErr != nil {
			return manifest{}, "", readErr
		}
		body = content
		if len(body) > maxManifest {
			return manifest{}, "", errors.New("release catalog exceeds the 1 MiB limit")
		}
	} else {
		content, readErr := os.ReadFile(source)
		if readErr != nil {
			return manifest{}, "", fmt.Errorf("read release catalog: %w", readErr)
		}
		body = content
		baseURL = defaultManifest
	}
	var catalog manifest
	if err := json.Unmarshal(body, &catalog); err != nil {
		return manifest{}, "", fmt.Errorf("parse release catalog: %w", err)
	}
	if catalog.SchemaVersion != 1 || len(catalog.Platforms) == 0 {
		return manifest{}, "", errors.New("release catalog has an unsupported schema")
	}
	return catalog, baseURL, nil
}

func selectLinuxRelease(catalog manifest, system target) (candidate, error) {
	platformInfo, ok := catalog.Platforms["linux"]
	if !ok {
		return candidate{}, errors.New("catalog has no Linux releases")
	}
	if system.Architecture != "x86_64" {
		return candidate{}, fmt.Errorf("no Linux manager release supports %s", system.Architecture)
	}
	if system.LibcName != "glibc" {
		return candidate{}, fmt.Errorf("this release requires glibc; detected %s", firstNonempty(system.LibcName, "unknown libc"))
	}
	candidates := []candidate{}
	reasons := []string{}
	for _, release := range platformInfo.Releases {
		if required := stringValue(release.Minimum["architecture"]); required != "" && required != system.Architecture {
			reasons = append(reasons, "release "+release.Version+" requires "+required)
			continue
		}
		if minimum := stringValue(release.Minimum["glibc"]); minimum != "" && compareVersion(system.LibcVersion, minimum) < 0 {
			reasons = append(reasons, "release "+release.Version+" requires glibc "+minimum)
			continue
		}
		priority, warning, reason := matchLinuxTargets(release, system)
		if reason != "" {
			reasons = append(reasons, reason)
			continue
		}
		if tested := testedGlibc(release); tested != "" && compareVersion(system.LibcVersion, tested) < 0 {
			warning = firstNonempty(warning, release.CompatibilityNote)
		}
		candidates = append(candidates, candidate{Release: release, Priority: priority, Warning: warning})
	}
	if len(candidates) == 0 {
		return candidate{}, fmt.Errorf("no compatible Ghost Surfer release for %s: %s", displayTarget(system), strings.Join(reasons, "; "))
	}
	best := candidates[0]
	for _, current := range candidates[1:] {
		if current.Priority > best.Priority || (current.Priority == best.Priority && compareVersion(current.Release.Version, best.Release.Version) > 0) {
			best = current
		}
	}
	return best, nil
}

func matchLinuxTargets(release release, system target) (int, string, string) {
	if len(release.CompatibleTargets) == 0 {
		return 0, firstNonempty(release.CompatibilityNote, "This Linux derivative is not listed as verified."), ""
	}
	bestPriority := -1
	bestWarning := ""
	for _, group := range release.CompatibleTargets {
		ids := lowerSet(group.DistroIDs)
		families := lowerSet(group.DistroFamilies)
		exact := ids[system.DistroID]
		family := containsAny(families, system.DistroLike) || families[system.DistroID]
		if !exact && !family && !group.Fallback {
			continue
		}
		versionLimits := group.MinimumVersions
		requiredVersion := versionLimits[system.DistroID]
		if requiredVersion == "" {
			for _, value := range system.DistroLike {
				if versionLimits[value] != "" {
					requiredVersion = versionLimits[value]
					break
				}
			}
		}
		if requiredVersion != "" && system.DistroVersion != "" && compareVersion(system.DistroVersion, requiredVersion) < 0 {
			continue
		}
		maximumVersion := group.MaximumVersions[system.DistroID]
		if maximumVersion == "" {
			for _, value := range system.DistroLike {
				if group.MaximumVersions[value] != "" {
					maximumVersion = group.MaximumVersions[value]
					break
				}
			}
		}
		if maximumVersion != "" && system.DistroVersion != "" && compareVersion(system.DistroVersion, maximumVersion) > 0 {
			continue
		}
		if group.MinimumGlibc != "" && compareVersion(system.LibcVersion, group.MinimumGlibc) < 0 {
			continue
		}
		priority := 0
		if exact {
			priority = 300
		} else if family {
			priority = 200
		}
		if group.Verified {
			priority += 1000
		}
		candidateWarning := ""
		if !group.Verified {
			candidateWarning = firstNonempty(group.Warning, release.CompatibilityNote, "This Linux derivative is not verified for this release.")
		}
		if priority > bestPriority {
			bestPriority = priority
			bestWarning = candidateWarning
		}
	}
	if bestPriority < 0 {
		family := strings.Join(system.DistroLike, ", ")
		return -1, "", fmt.Sprintf("no compatible release target for distro %s (ID_LIKE=%s)", firstNonempty(system.DistroID, "unknown"), firstNonempty(family, "unknown"))
	}
	return bestPriority, bestWarning, ""
}

func testedGlibc(item release) string {
	if value, ok := item.Tested["glibc"].(string); ok {
		return value
	}
	return ""
}

func printPlan(source string, system target) (candidate, string, error) {
	catalog, baseURL, err := loadManifest(source)
	if err != nil {
		return candidate{}, "", err
	}
	selected, err := selectLinuxRelease(catalog, system)
	if err != nil {
		return candidate{}, "", err
	}
	artifactURL, err := resolveArtifactURL(selected.Release.Artifact.URL, baseURL)
	if err != nil {
		return candidate{}, "", err
	}
	fmt.Printf("Detected: %s\n", displayTarget(system))
	fmt.Printf("Selected Ghost Surfer: %s\n", selected.Release.Version)
	fmt.Printf("Release package: %s\n", selected.Release.Artifact.Name)
	fmt.Printf("Package URL: %s\n", artifactURL)
	if selected.Warning != "" {
		fmt.Printf("Compatibility warning: %s\n", selected.Warning)
	}
	return selected, artifactURL, nil
}

func showPlan(manifestURL string, system target) error {
	_, _, err := printPlan(manifestURL, system)
	return err
}

func installOrUpdate(action, manifestURL string, system target, allowUnverified bool) error {
	if action == "install" && appInstalled() {
		return errors.New("Ghost Surfer is already installed; use update or reinstall")
	}
	if action == "update" && !appInstalled() {
		fmt.Println("Ghost Surfer is not installed; continuing with a new install.")
	}
	if err := installSelf(); err != nil {
		return fmt.Errorf("install manager for future use: %w", err)
	}
	selected, downloadURL, err := printPlan(manifestURL, system)
	if err != nil {
		return err
	}
	if selected.Warning != "" && !allowUnverified {
		return fmt.Errorf("review the compatibility warning above; rerun with --allow-unverified to continue")
	}
	cache, err := managerCache()
	if err != nil {
		return err
	}
	packagePath, err := downloadRelease(downloadURL, selected.Release.Artifact, cache)
	if err != nil {
		return err
	}
	staging, err := os.MkdirTemp(cache, ".ghost-surfer-app-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(staging)
	if err := extractTarGzip(packagePath, staging); err != nil {
		return fmt.Errorf("verify and unpack app release: %w", err)
	}
	installer, err := findInstaller(staging)
	if err != nil {
		return err
	}
	fmt.Printf("Starting verified per-user installation of Ghost Surfer %s…\n", selected.Release.Version)
	command := exec.Command("bash", installer)
	command.Env = append(os.Environ(), "GHOST_SURFER_SKIP_LAUNCH=1")
	command.Stdin, command.Stdout, command.Stderr = os.Stdin, os.Stdout, os.Stderr
	if err := command.Run(); err != nil {
		return fmt.Errorf("Ghost Surfer installer stopped: %w", err)
	}
	if err := writeInstalledState(selected.Release, system); err != nil {
		return fmt.Errorf("app installed, but version record failed: %w", err)
	}
	if err := installSelf(); err != nil {
		return fmt.Errorf("app installed, but manager command could not be restored: %w", err)
	}
	fmt.Printf("Ghost Surfer %s installed for this user. Run 'ghost-surfer-manager status' to inspect it.\n", selected.Release.Version)
	return nil
}

func downloadRelease(downloadURL string, item artifact, cache string) (string, error) {
	if item.Name == "" || filepath.Base(item.Name) != item.Name || item.Name == "." || item.Name == ".." {
		return "", errors.New("release catalog has an unsafe package filename")
	}
	if len(item.SHA256) != 64 {
		return "", errors.New("release catalog is missing a valid SHA-256 checksum")
	}
	parsed, err := url.Parse(downloadURL)
	if err != nil || parsed.Scheme != "https" {
		return "", errors.New("release package must be downloaded over HTTPS")
	}
	finalPath := filepath.Join(cache, item.Name)
	if info, err := os.Lstat(finalPath); err == nil && info.Mode().IsRegular() {
		if digest, err := fileSHA256(finalPath); err == nil && strings.EqualFold(digest, item.SHA256) {
			fmt.Println("Using cached package with a matching SHA-256 checksum.")
			return finalPath, nil
		}
	}
	request, _ := http.NewRequest(http.MethodGet, downloadURL, nil)
	request.Header.Set("User-Agent", "GhostSurfer-Linux-Installation-Manager")
	client := &http.Client{Timeout: 0, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if req.URL.Scheme != "https" {
			return errors.New("package download redirected away from HTTPS")
		}
		return nil
	}}
	response, err := client.Do(request)
	if err != nil {
		return "", fmt.Errorf("download release package: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("release package returned HTTP %d", response.StatusCode)
	}
	if response.ContentLength > maxPackage {
		return "", errors.New("release package exceeds the 2 GiB limit")
	}
	temporary, err := os.CreateTemp(cache, ".ghost-surfer-release-*.download")
	if err != nil {
		return "", err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	hash := sha256.New()
	written, copyErr := io.Copy(io.MultiWriter(temporary, hash), io.LimitReader(response.Body, maxPackage+1))
	closeErr := temporary.Close()
	if copyErr != nil {
		return "", copyErr
	}
	if closeErr != nil {
		return "", closeErr
	}
	if written > maxPackage {
		return "", errors.New("release package exceeds the 2 GiB limit")
	}
	if !strings.EqualFold(hex.EncodeToString(hash.Sum(nil)), item.SHA256) {
		return "", errors.New("release package SHA-256 did not match the catalog; the download was discarded")
	}
	if err := os.Chmod(temporaryPath, 0600); err != nil {
		return "", err
	}
	if err := os.Rename(temporaryPath, finalPath); err != nil {
		return "", err
	}
	return finalPath, nil
}

func resolveArtifactURL(raw, manifestURL string) (string, error) {
	base, err := url.Parse(manifestURL)
	if err != nil {
		return "", err
	}
	if base.Scheme != "https" {
		base, _ = url.Parse(defaultManifest)
	}
	asset, err := url.Parse(raw)
	if err != nil {
		return "", err
	}
	resolved := base.ResolveReference(asset)
	if resolved.Scheme != "https" {
		return "", errors.New("release catalog has a non-HTTPS package URL")
	}
	return resolved.String(), nil
}

func extractTarGzip(packagePath, destination string) error {
	file, err := os.Open(packagePath)
	if err != nil {
		return err
	}
	defer file.Close()
	gz, err := gzip.NewReader(file)
	if err != nil {
		return err
	}
	defer gz.Close()
	reader := tar.NewReader(gz)
	base, err := filepath.Abs(destination)
	if err != nil {
		return err
	}
	var expanded int64
	count := 0
	for {
		header, err := reader.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return err
		}
		count++
		if count > maxFiles || header.Size < 0 {
			return errors.New("release archive has an invalid file count or size")
		}
		expanded += header.Size
		if expanded > maxExpanded {
			return errors.New("release archive expands beyond the 8 GiB limit")
		}
		cleanName, err := safeArchiveName(header.Name)
		if err != nil {
			return err
		}
		target := filepath.Join(base, filepath.FromSlash(cleanName))
		if !withinDirectory(base, target) {
			return errors.New("release archive contains a path outside its root")
		}
		if err := ensureSafeParents(base, filepath.Dir(target)); err != nil {
			return err
		}
		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
		case tar.TypeReg, tar.TypeRegA:
			mode := os.FileMode(header.Mode) & 0755
			if mode == 0 {
				mode = 0644
			}
			output, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, mode)
			if err != nil {
				return err
			}
			copied, copyErr := io.CopyN(output, reader, header.Size)
			closeErr := output.Close()
			if copyErr != nil || copied != header.Size {
				return firstError(copyErr, errors.New("archive member was truncated"))
			}
			if closeErr != nil {
				return closeErr
			}
		case tar.TypeSymlink:
			if !safeLinkTarget(cleanName, header.Linkname) {
				return errors.New("release archive contains an unsafe symbolic link")
			}
			if err := os.Symlink(header.Linkname, target); err != nil {
				return err
			}
		case tar.TypeLink:
			linkName, err := safeArchiveName(header.Linkname)
			if err != nil {
				return errors.New("release archive contains an unsafe hard link")
			}
			linkTarget := filepath.Join(base, filepath.FromSlash(linkName))
			if !withinDirectory(base, linkTarget) {
				return errors.New("release archive contains a hard link outside its root")
			}
			info, err := os.Lstat(linkTarget)
			if err != nil || !info.Mode().IsRegular() {
				return errors.New("release archive contains an invalid hard link")
			}
			if err := os.Link(linkTarget, target); err != nil {
				return err
			}
		default:
			return fmt.Errorf("release archive contains unsupported entry type %d", header.Typeflag)
		}
	}
	return nil
}

func safeArchiveName(name string) (string, error) {
	name = strings.ReplaceAll(name, "\\", "/")
	clean := path.Clean(name)
	if clean == "." || path.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, "../") || strings.Contains(clean, ":") {
		return "", fmt.Errorf("release archive contains unsafe path %q", name)
	}
	return clean, nil
}

func safeLinkTarget(linkPath, target string) bool {
	if target == "" || path.IsAbs(strings.ReplaceAll(target, "\\", "/")) {
		return false
	}
	resolved := path.Clean(path.Join(path.Dir(linkPath), strings.ReplaceAll(target, "\\", "/")))
	return resolved != ".." && !strings.HasPrefix(resolved, "../")
}

func ensureSafeParents(root, parent string) error {
	relative, err := filepath.Rel(root, parent)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(os.PathSeparator)) {
		return errors.New("release archive path escaped the staging directory")
	}
	current := root
	for _, part := range strings.Split(relative, string(os.PathSeparator)) {
		if part == "" || part == "." {
			continue
		}
		current = filepath.Join(current, part)
		info, err := os.Lstat(current)
		if errors.Is(err, os.ErrNotExist) {
			if err := os.Mkdir(current, 0755); err != nil && !errors.Is(err, os.ErrExist) {
				return err
			}
			continue
		}
		if err != nil {
			return err
		}
		if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
			return errors.New("release archive attempts to write through a non-directory path")
		}
	}
	return nil
}

func withinDirectory(root, target string) bool {
	relative, err := filepath.Rel(root, target)
	return err == nil && relative != ".." && !strings.HasPrefix(relative, ".."+string(os.PathSeparator))
}

func findInstaller(root string) (string, error) {
	var found string
	err := filepath.WalkDir(root, func(name string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.Type()&os.ModeSymlink != 0 {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if !entry.IsDir() && entry.Name() == "install-linux.sh" {
			found = name
			return filepath.SkipAll
		}
		return nil
	})
	if err != nil && !errors.Is(err, filepath.SkipAll) {
		return "", err
	}
	if found == "" {
		return "", errors.New("verified Linux package does not contain install-linux.sh")
	}
	return found, nil
}

func showStatus(system target) error {
	fmt.Printf("Detected: %s\n", displayTarget(system))
	if !appInstalled() {
		fmt.Println("Ghost Surfer is not installed.")
		return nil
	}
	fmt.Printf("Ghost Surfer is installed at %s\n", appDirectory())
	if state, err := os.ReadFile(filepath.Join(appDirectory(), ".ghost-surfer-manager-state.json")); err == nil {
		fmt.Printf("Manager record: %s\n", strings.TrimSpace(string(state)))
	}
	return nil
}

func launchApp() error {
	app := filepath.Join(appDirectory(), "ghost-surfer")
	if !regularFile(app) {
		return errors.New("Ghost Surfer is not installed")
	}
	return exec.Command(app).Start()
}

func uninstall(removeProfile bool) error {
	appDir := appDirectory()
	uninstaller := filepath.Join(appDir, "uninstall-linux.sh")
	if !regularFile(uninstaller) {
		return errors.New("Ghost Surfer's managed uninstaller is missing")
	}
	command := exec.Command("bash", uninstaller, appDir)
	command.Stdin, command.Stdout, command.Stderr = os.Stdin, os.Stdout, os.Stderr
	if err := command.Run(); err != nil {
		return fmt.Errorf("Ghost Surfer uninstall stopped: %w", err)
	}
	if removeProfile {
		profile, err := profileDirectory()
		if err != nil {
			return err
		}
		if err := os.RemoveAll(profile); err != nil {
			return fmt.Errorf("remove browser profile: %w", err)
		}
	}
	if err := os.RemoveAll(managerDirectory()); err != nil {
		return fmt.Errorf("remove manager files: %w", err)
	}
	if err := os.Remove(managerCommand()); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("remove manager command: %w", err)
	}
	if cache, err := managerCache(); err == nil {
		_ = os.RemoveAll(cache)
	}
	fmt.Println("Ghost Surfer and its installation manager were removed. Profile data was kept unless you selected --remove-profile.")
	return nil
}

func writeInstalledState(item release, system target) error {
	state := map[string]any{
		"version":             item.Version,
		"distributionId":      system.DistroID,
		"distributionName":    system.DistroName,
		"distributionVersion": system.DistroVersion,
		"architecture":        system.Architecture,
		"glibc":               system.LibcVersion,
		"installedAt":         time.Now().UTC().Format(time.RFC3339),
	}
	body, _ := json.MarshalIndent(state, "", "  ")
	return os.WriteFile(filepath.Join(appDirectory(), ".ghost-surfer-manager-state.json"), body, 0600)
}

func installSelf() error {
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	if info, err := os.Lstat(managerDirectory()); err == nil && (info.Mode()&os.ModeSymlink != 0 || !info.IsDir()) {
		return errors.New("manager installation directory is not a regular directory")
	}
	if err := os.MkdirAll(managerDirectory(), 0700); err != nil {
		return err
	}
	if err := ensureOwnedDirectory(managerDirectory()); err != nil {
		return err
	}
	input, err := os.Open(executable)
	if err != nil {
		return err
	}
	defer input.Close()
	temporary, err := os.CreateTemp(managerDirectory(), ".manager-*.tmp")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if _, err := io.Copy(temporary, input); err != nil {
		temporary.Close()
		return err
	}
	if err := temporary.Chmod(0755); err != nil {
		temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	if err := os.Rename(temporaryPath, managerExecutable()); err != nil {
		return err
	}
	if err := os.MkdirAll(managerBinDirectory(), 0755); err != nil {
		return err
	}
	if err := ensureOwnedDirectory(managerBinDirectory()); err != nil {
		return err
	}
	launcher := "#!/bin/sh\nexec " + shellQuote(managerExecutable()) + " \"$@\"\n"
	return os.WriteFile(managerCommand(), []byte(launcher), 0755)
}

func ensureOwnedDirectory(name string) error {
	info, err := os.Lstat(name)
	if err != nil {
		return err
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
		return fmt.Errorf("refusing unsafe manager directory %s", name)
	}
	if stat, ok := info.Sys().(*syscall.Stat_t); ok && int(stat.Uid) != os.Getuid() {
		return fmt.Errorf("manager directory %s is not owned by this user", name)
	}
	return nil
}

func managerDirectory() string {
	return filepath.Join(homeDirectory(), ".local", "opt", "ghost-surfer-manager")
}
func managerExecutable() string { return filepath.Join(managerDirectory(), "ghost-surfer-manager") }
func managerBinDirectory() string {
	if value := os.Getenv("XDG_BIN_HOME"); value != "" {
		return value
	}
	return filepath.Join(homeDirectory(), ".local", "bin")
}
func managerCommand() string { return filepath.Join(managerBinDirectory(), "ghost-surfer-manager") }
func appDirectory() string   { return filepath.Join(homeDirectory(), ".local", "opt", "ghost-surfer") }
func homeDirectory() string {
	if value := os.Getenv("HOME"); value != "" {
		return value
	}
	value, _ := os.UserHomeDir()
	return value
}
func appInstalled() bool { return regularFile(filepath.Join(appDirectory(), "ghost-surfer")) }
func regularFile(name string) bool {
	info, err := os.Lstat(name)
	return err == nil && info.Mode().IsRegular()
}

func managerCache() (string, error) {
	base := os.Getenv("XDG_CACHE_HOME")
	if base == "" {
		base = filepath.Join(homeDirectory(), ".cache")
	}
	cache := filepath.Join(base, "ghost-surfer-manager")
	if err := os.MkdirAll(cache, 0700); err != nil {
		return "", err
	}
	if err := ensureOwnedDirectory(cache); err != nil {
		return "", err
	}
	return cache, nil
}

func profileDirectory() (string, error) {
	base := os.Getenv("XDG_DATA_HOME")
	if base == "" {
		base = filepath.Join(homeDirectory(), ".local", "share")
	}
	profile := filepath.Join(base, "ghost-surfer")
	if !withinDirectory(homeDirectory(), profile) {
		return "", errors.New("browser profile path is outside the user's home directory")
	}
	if info, err := os.Lstat(profile); err == nil && info.Mode()&os.ModeSymlink != 0 {
		return "", errors.New("refusing to remove browser profile through a symbolic link")
	}
	return profile, nil
}

func fileSHA256(name string) (string, error) {
	file, err := os.Open(name)
	if err != nil {
		return "", err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func splitLower(value string) []string {
	parts := strings.Fields(strings.ToLower(value))
	return parts
}
func lowerSet(values []string) map[string]bool {
	set := map[string]bool{}
	for _, value := range values {
		set[strings.ToLower(value)] = true
	}
	return set
}
func containsAny(values map[string]bool, targets []string) bool {
	for _, target := range targets {
		if values[strings.ToLower(target)] {
			return true
		}
	}
	return false
}
func firstNonempty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case json.Number:
		return typed.String()
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	default:
		return ""
	}
}
func compareVersion(left, right string) int {
	a, b := versionParts(left), versionParts(right)
	for len(a) < len(b) {
		a = append(a, 0)
	}
	for len(b) < len(a) {
		b = append(b, 0)
	}
	for i := range a {
		if a[i] < b[i] {
			return -1
		}
		if a[i] > b[i] {
			return 1
		}
	}
	return 0
}
func versionParts(value string) []int {
	parts := []int{}
	current := strings.Builder{}
	for _, char := range value {
		if char >= '0' && char <= '9' {
			current.WriteRune(char)
		} else if current.Len() > 0 {
			item, _ := strconv.Atoi(current.String())
			parts = append(parts, item)
			current.Reset()
		}
	}
	if current.Len() > 0 {
		item, _ := strconv.Atoi(current.String())
		parts = append(parts, item)
	}
	return parts
}
func shellQuote(value string) string { return "'" + strings.ReplaceAll(value, "'", "'\\''") + "'" }
func firstError(values ...error) error {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}
