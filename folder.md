# Gabay sa Proyekto: Project Structure at Folders (folder.md)

Maligayang pagdating sa React! Ang dokumentong ito ay ginawa para tulungan kang maunawaan ang **folder structure** ng **Ready Alert** app, kung ano ang ginagampanan ng bawat file, at kung **saan ka pupunta** kapag gusto mong magdagdag ng bagong features o codes.

---

## 📁 1. Pangkalahatang Folder Structure

Narito ang mapa ng ating buong proyekto:

```text
Ready Alert/
├── firebase-applet-config.json  # Configuration ng Firebase connection
├── firestore.rules               # Security rules ng ating Firestore database
├── package.json                  # Talaan ng npm packages at dependencies
├── schema.md                     # Paliwanag sa Database Schema at Entities
├── changes.md                    # Buod ng mga pagbabago at features
├── folder.md                     # Ang gabay na ito!
└── src/                          # 💡 DITO NAKALAGAY ANG BUONG CODE NG APP
    ├── @types/                   # Type Definitions (Data Interfaces)
    │   └── index.ts
    ├── config/                   # Configuration Files (Firebase setup)
    │   └── firebase.ts
    ├── context/                  # Global State (Login & Roles)
    │   └── AuthContext.tsx
    ├── services/                 # Database Operations & Queries
    │   ├── alertService.ts
    │   ├── authService.ts
    │   ├── groupService.ts
    │   └── userService.ts
    ├── hooks/                    # Custom Real-time Firebase Listeners
    │   ├── useActiveAlert.ts
    │   ├── useGroupData.ts
    │   └── useMembers.ts
    ├── components/               # Reusable UI Components
    │   ├── AlertBanner.tsx
    │   ├── BottomNav.tsx         # Mobile Bottom Navigation Bar (56px+ touch target)
    │   ├── HeaderBar.tsx
    │   ├── RoleBadge.tsx
    │   └── TriAlarmPanel.tsx
    ├── pages/                    # Main Screens / Dashboards
    │   ├── HostDashboard.tsx
    │   ├── LeaderDashboard.tsx
    │   ├── MemberDashboard.tsx
    │   └── LoginPage.tsx
    ├── styles/                   # Custom Tailwind Styles
    │   └── index.css
    ├── App.tsx                   # Main Routing Component
    ├── index.css                 # Main CSS Entry
    └── main.tsx                  # React DOM Entry Point
```

---

## 🎯 2. Ano ang Ginagawa ng Bawat Folder?

### 1. `src/@types/` (Data Models & TypeScript Interfaces)
* **Bakit mahalaga?** Dito natin tinutukoy ang hugis o istraktura ng ating data (tulad ng `UserProfile`, `Alert`, `Member`, at `Group`).
* **Paano gumagana?** Sinisigurado nito na walang mali sa pag-type ng property names sa ating code.

### 2. `src/config/` (System Configurations)
* **Bakit mahalaga?** Inii-initialize nito ang ating **Firebase App**, **Auth**, at **Firestore Database**.
* **File:** `firebase.ts` — Nagkokonekta sa ating React app papunta sa ating cloud database.

### 3. `src/context/` (Global State Management)
* **Bakit mahalaga?** Nag-iingat sa impormasyon ng **nakalog-in na user**, kanyang **role** (Host, Leader, o Member), at nagbibigay ng `login()`, `register()`, at `logout()` functions sa buong app.
* **File:** `AuthContext.tsx` — Kahit anong component sa app ay kayang magbasa kung sino ang kasalukuyang nakalog-in dahil dito.

### 4. `src/services/` (Database Logic & Queries)
* **Bakit mahalaga?** Dito nakasulat ang totoong pakikipag-usap sa Firebase (Create, Read, Update).
* **Mga File:**
  * `alertService.ts` ➔ Nagpapadala ng Tri-Alarm alerts at Host backup alerts.
  * `userService.ts` ➔ Nag-a-update ng emergency status ng mga members at kumuha ng user profile.
  * `groupService.ts` ➔ Gumagawa at kumuha ng volunteer groups.
  * `authService.ts` ➔ Nagpapatakbo ng login/register at demo accounts.

### 5. `src/hooks/` (Real-Time Live Streams)
* **Bakit mahalaga?** Sa React, ginagamit ang **Hooks** para kumuha ng live data mula sa Firebase gamit ang `onSnapshot`.
* **Paano gumagana?** Kapag may bagong alert o nagbago ang status ng isang miyembro, **kusa/awtomatikong mag-u-update ang screen** nang hindi kailangang mag-refresh!

### 6. `src/components/` (Maliit at Reusable na UI Parts)
* **Bakit mahalaga?** Ito ang mga pyesa o "Lego blocks" ng ating user interface.
* **Mga File:**
  * `AlertBanner.tsx` ➔ Ang kulay-pula/dilaw/berde na banner sa taas na nag-aalerto.
  * `TriAlarmPanel.tsx` ➔ Ang control panel na may malalaking buttons para mag-broadcast ng emergency alarms.
  * `HeaderBar.tsx` ➔ Ang top navigation bar na may pangalan ng user at Quick Role Switcher.
  * `RoleBadge.tsx` ➔ Maliit na badge na nagpapakita ng papel ng user (Host / Leader / Member).

### 7. `src/pages/` (Mga Buong Screen / Dashboards)
* **Bakit mahalaga?** Dito pinagsasama-sama ang mga components para buuin ang mismong buong pahina o screen na nakikita ng user batay sa kanyang role.
* **Mga File:**
  * `LoginPage.tsx` ➔ Pahina para sa Sign In, Register, at Demo Login.
  * `HostDashboard.tsx` ➔ Dashboard para sa Host HQ.
  * `LeaderDashboard.tsx` ➔ Dashboard para sa Youth Leader.
  * `MemberDashboard.tsx` ➔ Dashboard para sa Volunteer Member.

---

## 🚀 3. Saan Ako Pupunta Kapag Gusto Kong Magdagdag?

| Gusto kong... | Saan ako pupunta o magdadagdag ng code? |
| :--- | :--- |
| **Magdagdag ng Bagong Attribute sa User o Alert** | Go to `src/@types/index.ts` para idagdag ang bagong field type. |
| **Magdagdag ng Bagong Button o UI Element sa Dashboard** | Go to the specific screen in `src/pages/` (e.g. `MemberDashboard.tsx`). |
| **Magdagdag ng Reusable UI Element (e.g. Pop-up Modal o Card)** | Create a new file in `src/components/` (e.g. `EmergencyModal.tsx`). |
| **Magdagdag ng Bagong Database Query o Function** | Go to `src/services/` and add the export function in the proper service file. |
| **Magdagdag ng Bagong Page o Screen** | 1. Create `NewPage.tsx` in `src/pages/`<br>2. Import and add it inside `src/App.tsx`. |
| **Magbago ng Kulay o Tailwind Styling** | Open the respective `.tsx` file and change the Tailwind classes (e.g., `bg-red-600`, `text-white`). |

---

## 💡 Paalala sa Pag-aaral ng React:
1. **Components (.tsx):** Ang bawat `.tsx` file ay nagse-serve ng HTML structure (JSX) na pinapatakbo ng JavaScript logic.
2. **Props:** Ginagamit para magpasa ng data mula sa magulang (parent page) papunta sa anak (child component).
3. **State (`useState`):** Ginagamit para magtabi ng data na pwedeng magbago (tulad ng tina-type sa input box o kasalukuyangnapiling alert level).
