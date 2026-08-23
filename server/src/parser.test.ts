import assert from 'node:assert/strict'
import { parseServiceOrderEmail } from './parser.ts'

const ARMADILLO_SAMPLE = {
  fromHeader: 'Jeff <jeff@myhomesa.com>',
  subject: 'Fwd: ARMADILLO SERVICE ORDER: Claim 25833 - Air Conditioning System',
  text: `---------- Forwarded message ---------
From: Samuel Robinson from Armadillo Home Solutions <dispatch@armadillo.one>
Date: Tue, Aug 18, 2026 at 2:39 PM
Subject: ARMADILLO SERVICE ORDER: Claim 25833 - Air Conditioning System
To: jeff@myhomesa.com


Hi NRC Mechanical, we have a repair that should fit right into your wheelhouse!

Please call the customer within 1 business day and confirm the appointment for service.

Service Call Details:

* Claim #: 25833
* Customer: David Welker
* Address: 935 E Dullnig Court , San Antonio, Texas 78223
* Phone: (210) 792-7695
* Email Address: david.b.welker@gmail.com
* Covered Item: Air Conditioning System
* Brand, Make, Serial: Not Provided Please verify & document
* Reported Problem: There is no cold air in my house. Loud noise can be heard while AC is running.

Items NOT Covered by Customer's Plan:
Outside or underground piping, well pump, and well pump components for geothermal and/or water source heat pump. Window units, Water towers, Chillers, chiller components, and water lines nonducted wall units - Use of cranes or other lifting equipment to repair or replace units/system components Legally mandated diagnostic testing when replacing heating or cooling equipment drain line stoppages, refrigerant conversion, evaporator coil pan, and all exterior condensing, registers and grills, cooling and pump pads.

Appointment Preferences - note that homeowner often welcomes an earlier window than the times listed below:

Wednesday, August 19, 8am – 12pm
Friday, August 21, 8am – 12pm
Thursday, August 20, 8am – 12pm

All Itemized Invoices Should Include:

1. Detailed Diagnosis of the failure (why is the system not operating?)
2. Cause of failure (what caused this failure?)
3. Brand/ Model/Serial when applicable + any important specs on the system
Send invoices to pro@armadillo.one. Include "25833 - Invoice" in the subject.

Repair Authorization:

Under $500 : Execute repairs and email invoice to pro@armadillo.one (if listed under NOT covered - do not repair - call Armadillo with your report)
Between $500-$1,000: Call (844) 332-4252 for same-day approval
Over $1,000: Send a detailed diagnosis and estimate to to pro@armadillo.one for review and approval. Include "25833 - Quote" in the subject.

Repair Rates (unless otherwise approved):

Call Out/Diagnosis Fee $95
Hourly Rate: $95
Refrigerant rates: Max Invoiced to Armadillo: $50/lb, Max Charged to Customer: $75/lb

Reminder:

* Photo & document replaced parts
* Service only the issue(s) listed above

Please verify all completed work with the homeowner before leaving.

Thanks,
Armadillo Preferred Pro Dispatch Team

Sam Robinson
Dispatch Specialist
Armadillo Home Solutions
`,
}

const result = parseServiceOrderEmail(ARMADILLO_SAMPLE)

assert.equal(result.vendorName, 'Armadillo Home Solutions')
assert.equal(result.vendorEmail, 'dispatch@armadillo.one')
assert.equal(result.claimNumber, '25833')
assert.equal(result.customerName, 'David Welker')
assert.match(result.customerAddress, /935 E Dullnig Court/)
assert.equal(result.customerPhone, '(210) 792-7695')
assert.equal(result.customerEmail, 'david.b.welker@gmail.com')
assert.match(result.brand, /Air Conditioning System/)
assert.match(result.reportedProblem, /no cold air/)
assert.match(result.appointmentPreference, /Wednesday, August 19/)
assert.match(result.appointmentPreference, /Friday, August 21/)
assert.match(result.authorizationLimit, /\$500/)
assert.match(result.repairRate, /\$95/)
assert.equal(result.needsReview, false, `expected no missing fields, got: ${result.missingFields.join(', ')}`)

console.log('All parser assertions passed.')
console.log(JSON.stringify(result, null, 2))
