# Firebase Database Schema & System Configuration (schema.md)

Dokumento ukol sa **Firebase Configuration**, **Entities**, **Attributes**, at **Relationships** ng Ready Alert Emergency Communication System.

---

## 1. Firebase Project & Database Details

* **Applet Name:** Ready Alert
* **Firebase Project ID:** `ninth-theme-vjkjx`
* **Firestore Database ID:** `ai-studio-readyalert-de20df8c-54e7-4bd3-9b13-17c47fd29c17`
* **Authentication Provider:** Firebase Auth / Firestore Secured User Store
* **Configuration File:** `firebase-applet-config.json`

---

## 2. Seeded User Credentials (Mga Account at Password)

Pwedeng gamitin ang mga sumusunod na account para mag-login sa system:

| Role Identity | Email Address | Default Password | Full Name / Organization | Assigned Group ID |
| :--- | :--- | :--- | :--- | :--- |
| **Host Operations HQ** | `host@readyalert.org` | `password123` | Host Operations Center | `GRP-HQ` |
| **Youth Volunteer Leader** | `leader@readyalert.org` | `password123` | Leader Alex Rivera | `GRP-001` |
| **Volunteer Member 1** | `member1@readyalert.org` | `password123` | Sarah Chen (Member) | `GRP-001` |
| **Volunteer Member 2** | `member2@readyalert.org` | `password123` | David Miller (Member) | `GRP-001` |

---

## 3. System Entities & Attributes

### A. Host (`users` collection with `role: "HOST"`)
Kagawad ng Central Operations HQ na nagmo-monitor sa buong sistema.
* **uid / Host ID:** `string` (Unique ID)
* **name:** `string` (Pangalan ng Operations Center/Host)
* **email:** `string`
* **role:** `'HOST'`
* **contactNumber:** `string` (Numero ng Telepono)
* **organizationName:** `string` (Halimbawa: "National Disaster Preparedness HQ")
* **groupId:** `'GRP-HQ'`

---

### B. Youth Volunteer Leader (`users` collection with `role: "YOUTH_LEADER"`)
Pinuno ng isang nakatalagang Volunteer Group na may kakayahang mag-broadcast ng Tri-Alarm Alerts.
* **uid / Leader ID:** `string` (Unique ID)
* **name:** `string` (Pangalan ng Leader)
* **email:** `string`
* **contactNumber:** `string` (Contact Number)
* **role:** `'YOUTH_LEADER'`
* **groupId:** `string` (Halimbawa: "GRP-001")
* **organizationName:** `string` (Pangalan ng grupo/samahan)

---

### C. Volunteer Member (`users` collection with `role: "MEMBER"`)
Miyembro ng Volunteer Group na nagpapadala ng kanyang real-time emergency safety status.
* **uid / Member ID:** `string` (Unique ID)
* **name:** `string` (Pangalan ng Miyembro)
* **email:** `string`
* **contactNumber:** `string` (Contact Number)
* **role:** `'MEMBER'`
* **groupId:** `string` (Assigned Group ID)
* **emergencyStatus:** `'SAFE' | 'NEED_ASSISTANCE' | 'IN_DANGER' | 'UNACCOUNTED'`
* **updatedAt:** `string` (ISO Timestamp)

---

### D. Volunteer Group (`groups` collection)
Samahan ng mga volunteers sa ilalim ng pangangalaga ng isang Youth Leader.
* **groupId / id:** `string` (Unique Group ID, e.g., "GRP-001")
* **organizationName:** `string` (Pangalan ng Unidad/Organisasyon)
* **leaderId:** `string` (ID ng Youth Leader)
* **leaderName:** `string` (Pangalan ng Youth Leader)
* **memberCount:** `number` (Bilang ng miyembro)
* **createdAt:** `string` (ISO Timestamp)

---

### E. Emergency Alert (`alerts` collection)
Mga babala o Tri-Alarm notifications para sa lindol.
* **alertId / id:** `string` (Unique Alert ID)
* **alertLevel:** `'GREEN' | 'YELLOW' | 'RED'`
* **message:** `string` (Mensahe o paalala sa sakuna)
* **timestamp:** `string` (ISO Timestamp ng pagpapadala)
* **triggeredBy:** `string` (User ID ng nag-broadcast)
* **triggeredByName:** `string` (Pangalan ng nag-broadcast)
* **triggeredByRole:** `'YOUTH_LEADER' | 'HOST'`
* **groupId:** `string` (Target group o "GLOBAL_ALL")
* **isBackupAlert:** `boolean` (`true` kapag mula sa Host bilang override)
* **active:** `boolean` (`true` kapag umiiral ang alarma, `false` kapag na-clear na)

---

## 4. Relationships (Ugnayan ng mga Entidad at Administrative Powers)

1. **Host (HQ) Operations & Admin Powers:**
   - **Making Groups:** Ang **Host** ay may eksklusibong kakayahan na lumikha ng mga bagong **Volunteer Groups** (Organization Name, Group ID, at Leader assignment).
   - **Creating Users:** Ang **Host** ay pwedeng mag-register/mag-dagdag ng bagong **Youth Volunteer Leaders** at **Volunteer Members** diretso sa system.
   - **Assigning Users:** Ang **Host** ay maaaring mag-reassign ng mga miyembro o leaders mula sa isang Volunteer Group patungo sa ibang Volunteer Group.
   - **Monitoring:** Ang Host ay nagmo-monitor sa lahat ng Youth Volunteer Leaders at Volunteer Groups.

2. **Youth Volunteer Leader ➔ Volunteer Group:**
   - Ang **Youth Volunteer Leader** ay namamahala at kabilang sa isang partikular na **Volunteer Group**.

3. **Volunteer Member ➔ Volunteer Group:**
   - Ang bawat **Member** ay nakatalaga sa isang **Volunteer Group**.

4. **Youth Volunteer Leader ➔ Alerts:**
   - Ang **Youth Volunteer Leader** ay nagpapadala (transmit) ng **Tri-Alarm Alert** sa kanyang **Host** at sa kanyang mga **Members**.

5. **Host ➔ Backup Alerts:**
   - Ang **Host** ay nagpapadala ng **Backup Override Alert** nang direkta sa mga **Members** kung sakaling mag-fail o hindi makapag-transmit ang Leader.
