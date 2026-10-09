## Quiz Learning Pro v3.1.0

### What's Changed

#### 1. Smart Update Notification Snooze & Version Skip Engine
* **Flexible Snooze Durations**: Users can now postpone update notifications directly from the update modal with tailored time frames:
  * **24 Hours (1 Day)**
  * **3 Days**
  * **1 Week (7 Days)**
* **Skip Version Option**: Added a dedicated option to skip notifications entirely for the current release (`v3.1.0`), preventing recurring popups while keeping future major/minor releases unblocked.
* **Intelligent Background Suppression**:
  * Automatically suppresses startup popups and silences the flashing **"Bản mới!"** header alert during the active snooze window.
  * Preserves user focus during exams, custom study sessions, and flashcard reviews without intrusive interruptions.
* **On-Demand Manual Access & Instant Resume**:
  * Manual update checks via the User Profile and User Dropdown Menu remain accessible at all times, bypassing the snooze filter to display release notes and update controls on demand.
  * Active snooze status is clearly displayed with an ambient notice banner indicating the exact expiration time.
  * One-click **"Bật lại"** (Resume Notifications) button to immediately restore regular alerts at any time.
* **Reactive Cross-Component State Synchronization**: Snooze preferences persist locally and sync seamlessly across the application lifecycle using dedicated event broadcasts.

#### 2. Streamlined & Lean Release Distribution
* **Installer-Only Packaging**: In accordance with distribution optimization, only the highly compressed NSIS installer executable (`QuizLearningPro_Setup.exe`) is bundled and distributed, omitting oversized portable binaries for faster download speeds and reduced bandwidth overhead.
* **Zero Data Loss In-App Upgrades**: Full end-to-end compatibility with SQLite database preservation and cloud sync shields before applying updates.

#### 3. Reliability & Testing
* **100% Test Coverage for Snooze Logic**: Added automated unit tests covering duration calculation, version skipping, snooze clearing, and human-readable time formatting.
* **All 63 Unit Tests Passing**: Full green suite across core exam engines, database synchronizers, and UI components.

---

### Installation & Updates
* **In-App Update**: Launch the application and click **Cập nhật tự động (In-App Update)** in the update prompt to upgrade seamlessly.
* **Manual Setup**: Download and run `QuizLearningPro_Setup.exe` from the release assets below.

---

### Integrity Check
```
SHA-256 (Setup): 168F4FE9E55162EBFE582189F29572D2FCC643F0403F9705111814AE6E40B0F4
```
