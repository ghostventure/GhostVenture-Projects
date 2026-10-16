# EstateHat implementation inventory

Updated: 2026-10-16

This inventory maps 200 user and operator capability descriptions to the EstateHat source areas published from this checkout. It records the existing product surface; these are not 200 newly implemented capabilities. Only the specific modernization changes and checks listed in `MODERNIZATION_HANDOFF_2026-10-16.md` are counted as incremental implementation work. The grouped source references identify where each area is implemented; this inventory does not claim live verification of external provider workflows.

## Public site and discovery

Source: `app/page.jsx, src/MarketingLanding.jsx, src/estatehat-platform-alpha.jsx`

1. Public landing route with primary product actions.
2. Role-aware entry points for buyers and sellers.
3. Public company information route.
4. Public product help route.
5. Public FAQ and platform scope route.
6. Public terms route.
7. Public privacy route.
8. Public accessibility route.
9. Public DMCA route.
10. Public investor information route.

## Identity and sign-in

Source: `app/signin/page.jsx, src/AuthScreen.jsx, app/home/page.jsx`

11. Email sign-in form.
12. Account registration flow.
13. Authentication state listener.
14. Protected authenticated home route.
15. Sign-out action.
16. Profile bootstrap after sign-in.
17. Profile bootstrap retry action.
18. Auth callback stale-result protection.
19. Visible profile persistence failures.
20. Inactivity-triggered sign-out.

## Account roles and profile

Source: `src/backend.js, src/estatehat-platform-alpha.jsx`

21. Buyer account type.
22. Seller account type.
23. Corporate buyer account type.
24. Corporate seller account type.
25. Professional account types.
26. Government account types.
27. Role-specific navigation permissions.
28. Role conflict detection.
29. Role switch restrictions.
30. Normalized profile persistence.

## Identity verification

Source: `src/backend.js, src/estatehat-platform-alpha.jsx, firestore.rules`

31. Identity verification step tracking.
32. Selfie verification step tracking.
33. Address verification step tracking.
34. Citizenship verification step tracking.
35. SSN verification step tracking.
36. Homeowner verification step tracking.
37. Professional license verification step tracking.
38. Background-check step tracking.
39. Entity document verification.
40. Proof-of-funds verification.

## Compliance and trust

Source: `src/backend.js, firestore.rules, src/estatehat-platform-alpha.jsx`

41. Terms acceptance evidence.
42. Privacy acceptance evidence.
43. Legal disclosures evidence.
44. Electronic records consent evidence.
45. Non-brokerage acknowledgement.
46. Fair-housing attestation.
47. Platform fee disclosure acknowledgement.
48. Funds custody boundary acknowledgement.
49. Jurisdiction outlier detection.
50. Profile reputation grade calculation.

## Property search

Source: `src/estatehat-platform-alpha.jsx`

51. Listing browse view.
52. Debounced search input.
53. Property type filters.
54. Price range filters.
55. Bedroom filters.
56. Bathroom filters.
57. Location filters.
58. Sorting controls.
59. Search reset action.
60. Listing sync loading state.

## Listing cards and details

Source: `src/estatehat-platform-alpha.jsx`

61. Property card previews.
62. Property detail view.
63. Listing photo presentation.
64. Sale price presentation.
65. Listing status presentation.
66. Listing trust badge.
67. Featured listing badge.
68. Exact target ID featured matching.
69. Related listing navigation.
70. Listing view history tracking.

## Saved items and search

Source: `src/estatehat-platform-alpha.jsx`

71. Save listing action.
72. Remove saved listing action.
73. Watchlist view.
74. Recent viewed listing set.
75. Save search action.
76. Apply saved search action.
77. Remove saved search action.
78. Saved search label generation.
79. Saved listing count indicator.
80. Continue browsing list.

## Seller publishing workflow

Source: `src/estatehat-platform-alpha.jsx, functions/index.js, firestore.rules`

81. List property workflow.
82. Seller fee line creation.
83. Seller fee line editing.
84. Seller fee line removal.
85. Listing submission record creation.
86. Submission review status.
87. Submission review queue.
88. Publication status transition.
89. Listing submission access checks.
90. Seller submission confirmation.

## Property and transaction tools

Source: `src/estatehat-platform-alpha.jsx`

91. Offer composer view.
92. Mortgage calculator view.
93. Closing cost estimate.
94. Fee breakdown calculation.
95. Buyer fee calculation.
96. Seller fee line normalization.
97. Deal workspace view.
98. Deal participant display.
99. Deal sale cancellation flow.
100. Deal void-state tracking.

## Deal actions and timelines

Source: `src/estatehat-platform-alpha.jsx`

101. Active deal list.
102. Deal status display.
103. Deal checklist progress.
104. Deal health score panel.
105. Deal blocker presentation.
106. Action inbox view.
107. Role-aware action inbox items.
108. Milestone timeline view.
109. Transaction navigation shortcuts.
110. Deal-linked message navigation.

## Document handling

Source: `src/estatehat-platform-alpha.jsx, firestore.rules, storage.rules`

111. Document vault view.
112. Deal document attachment.
113. File picker launch.
114. Document metadata display.
115. Document upload zone.
116. Document type validation.
117. Document upload status.
118. Jurisdiction form templates.
119. Boilerplate forms view.
120. Document security rules.

## Messaging and collaboration

Source: `src/estatehat-platform-alpha.jsx, firestore.rules`

121. Messaging view.
122. Conversation list.
123. Conversation selection.
124. Conversation search.
125. Unread conversation state.
126. Deal participant context.
127. Property-linked conversation context.
128. Message composer.
129. Conversation prefill from deal.
130. Role-based message permissions.

## Professional matching

Source: `src/estatehat-platform-alpha.jsx, functions/index.js, firestore.rules`

131. Match services view.
132. Professional match request creation.
133. Manual professional attachment.
134. Deal service target display.
135. Featured professional placement workflow.
136. Featured service checkout launch.
137. Service role label formatting.
138. Active placement window formatting.
139. Placement activation check.
140. Placement access validation.

## Payments and incentives

Source: `src/estatehat-platform-alpha.jsx, functions/index.js`

141. Stripe verified profile checkout.
142. Verified billing portal launch.
143. Square subscription cancellation.
144. Stripe Connect onboarding.
145. Stripe Connect status refresh.
146. Platform fee checkout launch.
147. Referral incentive state calculation.
148. Referral credit recording.
149. Referral free month application.
150. Billing action feedback.

## Account security and privacy

Source: `src/estatehat-platform-alpha.jsx, src/useInactivityLogout.js, firestore.rules`

151. Inactivity timeout configuration.
152. Session logout after inactivity.
153. Document shield preference.
154. Login alert preference.
155. Trusted device preference.
156. Session timeout setting.
157. Account data masking preference.
158. Role-based data visibility.
159. User-scoped profile document access.
160. Authenticated write rules.

## Notifications and productivity

Source: `src/estatehat-platform-alpha.jsx`

161. Notifications view.
162. Action inbox summary.
163. Dashboard action shortcuts.
164. Home workspace quick actions.
165. Command palette.
166. Keyboard shortcut navigation.
167. Saved search quick access.
168. Recent views shortcuts.
169. Assistant contextual actions.
170. Dismissible toast notifications.

## Administration and oversight

Source: `src/estatehat-platform-alpha.jsx, firestore.rules, functions/index.js`

171. Admin oversight view.
172. Admin workbench view.
173. Listing review queue.
174. Transaction oversight cards.
175. Compliance flag filters.
176. Critical flag count.
177. Warning flag count.
178. Resolved flag count.
179. Admin action permission checks.
180. Backend health endpoint.

## Help, policy, and education

Source: `src/estatehat-platform-alpha.jsx, docs/`

181. Help center view.
182. FAQ view.
183. Terms content view.
184. Privacy content view.
185. Accessibility statement view.
186. DMCA policy view.
187. About page view.
188. Press information view.
189. Investor information view.
190. Role-specific platform guidance.

## Mobile and accessibility

Source: `src/estatehat-platform-alpha.jsx, app/layout.jsx, firebase.json`

191. Responsive compact layout detection.
192. Mobile bottom navigation.
193. Focus-visible shell outline.
194. Reduced-motion styling.
195. Scrollable navigation support.
196. Accessible route document titles.
197. Viewport-fit mobile layout.
198. Capacitor Android web target.
199. Capacitor iOS web target.
200. Text and responsive layout scaling.

