import ExpoModulesCore
import Foundation

/// iCloud Documents is available only in a signed development/production build.
/// Snapshots are immutable: offline devices write separate files, so eventual
/// iCloud delivery cannot silently replace another device's habit history.
public class HabitCloudModule: Module {
  private func directory() throws -> URL {
    guard FileManager.default.ubiquityIdentityToken != nil,
      let container = FileManager.default.url(forUbiquityContainerIdentifier: nil) else {
      throw NSError(domain: "HabitCloud", code: 1, userInfo: [NSLocalizedDescriptionKey: "cloudUnavailable"])
    }
    let directory = container.appendingPathComponent("Documents/Snapshots", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory
  }

  public func definition() -> ModuleDefinition {
    Name("HabitCloud")
    AsyncFunction("available") { () -> Bool in
      return FileManager.default.ubiquityIdentityToken != nil &&
        FileManager.default.url(forUbiquityContainerIdentifier: nil) != nil
    }
    AsyncFunction("readSnapshots") { () throws -> [String] in
      let directory = try self.directory()
      let urls = try FileManager.default.contentsOfDirectory(at: directory,
        includingPropertiesForKeys: [.ubiquitousItemDownloadingStatusKey], options: [])
      var results: [String] = []
      for original in urls {
        // .icloud placeholders may not have the JSON extension until downloaded.
        if original.pathExtension == "icloud" {
          var name = original.deletingPathExtension().lastPathComponent
          if name.hasPrefix(".") { name.removeFirst() }
          let target = original.deletingLastPathComponent().appendingPathComponent(name)
          try FileManager.default.startDownloadingUbiquitousItem(at: target)
          throw NSError(domain: "HabitCloud", code: 2, userInfo: [NSLocalizedDescriptionKey: "Download pending; retry sync"])
        }
        guard original.pathExtension == "json" else { continue }
        let values = try original.resourceValues(forKeys: [.ubiquitousItemDownloadingStatusKey])
        if let status = values.ubiquitousItemDownloadingStatus,
          status != .current && status != .downloaded {
          try FileManager.default.startDownloadingUbiquitousItem(at: original)
          throw NSError(domain: "HabitCloud", code: 2, userInfo: [NSLocalizedDescriptionKey: "Download pending; retry sync"])
        }
        var coordinateError: NSError?
        var readError: Error?
        let coordinator = NSFileCoordinator(filePresenter: nil)
        coordinator.coordinate(readingItemAt: original, options: [], error: &coordinateError) { url in
          do { results.append(try String(contentsOf: url, encoding: .utf8)) }
          catch { readError = error }
        }
        if let error = coordinateError { throw error }
        if let error = readError { throw error }
      }
      return results
    }
    AsyncFunction("writeSnapshot") { (revision: String, raw: String) throws in
      guard revision.range(of: "^[a-zA-Z0-9-]+$", options: .regularExpression) != nil else {
        throw NSError(domain: "HabitCloud", code: 3, userInfo: [NSLocalizedDescriptionKey: "Invalid revision"])
      }
      let url = try self.directory().appendingPathComponent(revision).appendingPathExtension("json")
      var coordinateError: NSError?
      var writeError: Error?
      NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: url, options: [], error: &coordinateError) { coordinated in
        do {
          if FileManager.default.fileExists(atPath: coordinated.path) {
            // Idempotent retries are safe, but an existing revision is immutable.
            guard try String(contentsOf: coordinated, encoding: .utf8) == raw else {
              throw NSError(domain: "HabitCloud", code: 4, userInfo: [NSLocalizedDescriptionKey: "Revision collision"])
            }
          } else { try Data(raw.utf8).write(to: coordinated, options: .atomic) }
        } catch { writeError = error }
      }
      if let error = coordinateError { throw error }
      if let error = writeError { throw error }
    }
  }
}
