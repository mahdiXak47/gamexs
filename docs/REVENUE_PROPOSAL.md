# GameXS Revenue Model Proposal

Cost Per Click (CPC) with Flexible Discounting and Promotional Campaigns

## 1. Executive Summary

The proposed revenue model for GameXS is based on charging partner stores for valid clicks that redirect users from GameXS to their stores.

GameXS helps users compare PS5 game prices and purchasing methods, while partner stores receive targeted traffic from users who are interested in purchasing specific games.

Under this model, GameXS tracks outgoing clicks and charges stores according to the number of valid, billable clicks. A completed purchase is not required for a click to be billable.

An important part of this model is the ability to offer promotional discounts and incentives. The system must support configurable discounts for a specified number of initial clicks, including the option to provide completely free clicks to selected stores. For example, a new store could receive a discount on its first several hundred clicks or receive up to 500 free clicks before standard billing begins.

These promotional offers are intended to reduce the initial barrier to cooperation, attract new stores, and allow them to evaluate the quality of GameXS traffic before committing to paid collaboration.

All numerical values, rates, limits, and commercial parameters are variable and must be adjusted based on real-world data, feedback from stores and users, and the results of pilot campaigns.

## 2. Revenue Model Overview

Under the CPC model, a store pays for each valid click that redirects a user from GameXS to the store's website or another designated destination.

The store remains responsible for product availability, final pricing, checkout, payment processing, delivery, and after-sales service.

The basic revenue formula is:

Gross click revenue = Number of valid billable clicks × CPC rate

The final amount payable is calculated after applying eligible discounts, promotional credits, and any necessary adjustments.

## 3. Definition of a Valid Click

The system must record outgoing clicks and classify them according to their validity and billing status.

The following categories should be tracked:

* Raw recorded clicks
* Valid, billable clicks
* Duplicate clicks according to configurable rules
* Suspicious or invalid clicks
* Clicks that cannot be verified because of technical errors or destination problems

The rules for validating clicks must be configurable. These include duplicate-click detection windows, suspicious-traffic detection, and the treatment of repeated visits.

Invalid clicks must not be charged. Suspicious clicks may be excluded from final billing until they have been reviewed.

The system should maintain separate records for click validity and billing eligibility. A valid click may be free because of a promotional campaign, while an invalid click is excluded because it does not satisfy the validity rules.

## 4. Pricing and Discount System

The pricing system must support both configurable base CPC rates and flexible discounts for individual stores.

### 4.1. Base CPC Rate

Each store must have a configurable base CPC rate.

The rate may depend on factors such as:

* Volume and quality of referred traffic
* Demand for the store's products
* Store feedback regarding referred users
* Purchase conversion data, if available
* Store margins and the commercial value of a click
* GameXS operating costs and revenue objectives

During the initial implementation, GameXS may use a common base rate for all stores. Different rates can be introduced later for individual stores or product categories as more data becomes available.

### 4.2. Discounts for Initial Clicks

The system must support promotional discounts based on the number of valid clicks generated for a particular store.

For example, administrators should be able to configure the following offers:

* A percentage discount for a specified number of initial clicks
* Completely free clicks for a specified initial period or click volume
* A return to the standard CPC rate after the promotional allowance has been exhausted
* Custom promotional terms for selected stores

For example, a newly onboarded store could receive its first 500 valid clicks free of charge. After the store reaches this limit, subsequent clicks would be billed at the standard CPC rate or according to another active discount agreement.

The number of free clicks must be configurable. The example of 500 clicks is illustrative and should not be treated as a fixed business rule.

### 4.3. Configurable Discount Percentage

The discount percentage must be configurable within a range of 10% to 100%.

Examples include:

* 10% discount: The store pays 90% of the base click rate.
* 50% discount: The store pays half of the base click rate.
* 100% discount: Eligible clicks are completely free.

The system should allow administrators to configure the desired discount percentage rather than limiting them to a small set of predefined values.

A 100% discount must result in zero click charges for the clicks covered by that discount.

### 4.4. Two Independent Discount Methods

The system must support two primary discount methods.

**A. Discount per click**

The discount is applied individually to each eligible click.

For example, if a store receives a 30% discount on its initial clicks, each eligible click is charged at 70% of the base CPC rate.

This method is suitable for volume-based promotions and tiered discounts, where different groups of clicks can have different rates.

For example, the first group of clicks may receive a higher discount, while subsequent clicks receive a smaller discount before the standard rate applies.

**B. Discount on the total amount**

The system first calculates the applicable click charges and then applies a percentage discount to the eligible total amount.

For example, a store may receive a general discount on its invoice at the end of a billing period.

This method is suitable for promotional campaigns, periodic offers, and commercial agreements with individual stores.

The system must clearly distinguish these two methods in its configuration, calculations, reports, and invoices.

### 4.5. Discount Configuration and Administration

For each discount or promotional campaign, administrators must be able to configure:

* The store or stores eligible for the offer
* Discount type: per-click or total-amount discount
* Discount percentage
* Number of clicks covered by the discount
* Number of completely free clicks
* Campaign start and end dates
* Campaign activation status
* Promotional budget or maximum discount allowance
* Store-specific discount agreements
* Rules for modifying or replacing existing campaigns
* Reporting of applied discounts and their financial impact

These settings should be manageable through the administrative interface wherever practical, without requiring code changes for routine commercial adjustments.

### 4.6. Handling Multiple Discounts

A store may qualify for more than one promotional offer at the same time. For example, its initial clicks may be free, and it may also qualify for a discount on its invoice at the end of the billing period.

The system must define how overlapping discounts are handled, including:

* Whether multiple discounts can be combined
* The order in which discounts are applied
* Which clicks or amounts each discount covers
* Whether combined discounts can reduce the final charge to zero
* Whether certain promotions are mutually exclusive

These rules must be explicit and configurable to prevent incorrect billing and disputes with stores.

As an initial default, the system should prevent unintended duplicate discount application. The rules governing discount stacking must be clearly defined for each applicable campaign.

### 4.7. Distinguishing Free Clicks from Invalid Clicks

Free clicks and invalid clicks must be treated as separate concepts.

A free click is a valid click that generates no charge because it is covered by a promotional offer. It must still be recorded in traffic reports and included in the assessment of GameXS traffic quality.

An invalid click is excluded from billing because it does not meet the system's click-validation requirements.

This distinction is essential for measuring campaign performance and accurately reporting the value delivered to partner stores.

## 5. Store Budgets and Spending Limits

Each store should have configurable financial and campaign limits, including:

* Advertising budget or available credit
* Maximum spending per billing period
* Maximum campaign expenditure
* Base CPC rate
* Applicable discount rules and free-click allowances
* Store collaboration status
* Available prepaid balance, if prepaid billing is used

When a store reaches its spending limit or exhausts its available balance, the system must follow the configured policy. This may include stopping paid referrals or changing the campaign status until additional credit is provided.

If free clicks and discounted clicks have separate budget limits, those limits must be explicitly configurable.

## 6. Store Onboarding and Collaboration Workflow

The proposed store collaboration process consists of the following steps:

1. Identify a potential partner store and initiate discussions.
2. Agree on the base CPC rate, collaboration terms, and discount conditions.
3. Register the store in the system.
4. Configure outbound links and activate click tracking.
5. Assign an initial promotional campaign, free-click allowance, or introductory discount.
6. Provide performance reports to the store.
7. Collect feedback regarding traffic quality and the overall collaboration.
8. Begin charging according to the agreed commercial terms.
9. Renew or adjust the collaboration based on observed results.

Free clicks and introductory discounts can be included in the initial commercial offer to reduce the perceived risk of joining GameXS.

## 7. Store Performance Reporting

Each store must be able to access clear reports showing its performance and associated charges.

Reports must distinguish between total recorded traffic, valid clicks, billable clicks, and free or discounted clicks.

Recommended report fields include:

* Reporting period
* Total recorded clicks
* Number of valid clicks
* Number of invalid, duplicate, and suspicious clicks
* Number of billable clicks
* Number of free clicks
* Number of discounted clicks
* Base CPC rate
* Total discount applied
* Cost before discounts
* Final amount payable
* Promotional credit used and remaining balance
* Campaign performance
* Performance by product or page, where sufficient data is available

Reports should make the value of promotional offers visible, including the number of free clicks and the amount saved through discounts.

## 8. Billing and Payments

Two primary billing methods can be considered.

**A. Postpaid billing**

The cost of valid billable clicks is calculated at the end of the billing period, and an invoice is issued to the store.

**B. Prepaid credit**

The store purchases credit in advance, and eligible click charges are deducted from its balance.

Promotional credits and free-click allowances must be recorded separately from paid credit so that the store's actual financial balance remains clear.

Under either method, invoices should include at least:

* Base click charges
* Number of billable clicks
* Discounts applied per click
* Discounts applied to the total amount
* Promotional credit or free-click value consumed
* Financial adjustments, where applicable
* Final amount payable

Payment terms, minimum prepaid balances, payment deadlines, and the treatment of unused credit must be defined in the commercial agreement.

## 9. Dispute Resolution

Stores may dispute the number of billed clicks, click validity, or the amount of a discount.

The system must provide enough historical data to investigate such disputes and reproduce the calculations used to generate an invoice.

Changes to CPC rates, discount rules, spending limits, and campaign conditions must be recorded in an audit history.

Any financial correction must be reflected in the relevant report and billing records.

## 10. Advertising Transparency and User Trust

Paid promotions must not compromise the accuracy or neutrality of GameXS price comparisons.

Sponsored placements must be distinguishable from organic price-comparison results. A store must not receive an artificially favorable price ranking merely because it pays GameXS or receives a promotional discount.

The objective is to preserve user trust while offering stores transparent and measurable advertising opportunities.

## 11. Performance Metrics

**Traffic Metrics**

* Total recorded clicks
* Number of valid clicks
* Invalid and suspicious click rate
* Click-through rate on store links
* Number of free and discounted clicks

**Revenue Metrics**

* Total revenue
* Revenue per valid click
* Total discount value granted
* Promotional value of free clicks
* Variable operating costs
* Contribution margin
* Monthly revenue per store

**Store Metrics**

* Number of active partner stores
* Number of stores entering a pilot campaign
* Conversion rate from pilot stores to paying customers
* Store renewal rate
* Average spending per store
* Store satisfaction with traffic quality
* Percentage of stores that continue paying after their free-click allowance ends

**Promotional Campaign Metrics**

* Number of stores using promotional offers
* Amount of free promotional credit used
* Number of clicks generated during promotional periods
* Conversion rate from discounted or free trials to paying partnerships
* Renewal rate after a campaign ends
* Cost of acquiring a store compared with its subsequent revenue
* Number of disputes related to discounts and invoices

If partner stores share completed-purchase data, GameXS can also measure click-to-purchase conversion rates and the commercial value of referred traffic. Access to such data is not required for the initial implementation.

## 12. Phased Implementation Plan

**Phase 1: Core CPC Functionality**

Implement the foundational billing capabilities:

* Outbound click tracking
* Valid and invalid click classification
* Configurable base CPC rates per store
* Calculation of billable click charges
* Basic performance reports and invoices

**Phase 2: Promotional Campaigns**

Introduce configurable promotional features:

* Percentage discounts per click
* Discounts on the total amount
* Initial-click discount allowances
* Completely free clicks
* Campaign start and end dates
* Promotional budgets and spending limits
* Discount reporting and invoice breakdowns

**Phase 3: Pilot Campaigns with Selected Stores**

Launch pilot campaigns with a limited number of partner stores.

Different commercial offers can be tested to understand which incentives are most effective in encouraging stores to join and continue using GameXS.

Some stores may receive free initial clicks, while others may receive percentage discounts. Feedback should be collected regarding traffic quality, report transparency, perceived click value, and commercial terms.

**Phase 4: Optimization and Expansion**

Use pilot results to adjust the base CPC rate, discount percentages, free-click allowances, budget limits, and renewal conditions.

As the model matures, GameXS can introduce more sophisticated promotional campaigns, tiered discounts, and offers tailored to individual store performance.

## 13. Configurable Parameters and Numerical Values

All numerical values and commercial or operational parameters must be configurable rather than hardcoded into the application.

These parameters include:

* Base CPC rate
* Discount percentage for each campaign
* Number of initial clicks eligible for discounts
* Number of free clicks
* Discount application order and combination rules
* Ability to combine per-click discounts with total-amount discounts
* Campaign budgets and spending limits
* Reporting and billing periods
* Prepaid credit and minimum balance requirements
* Duplicate-click detection windows
* Suspicious-traffic detection thresholds
* Pilot campaign duration
* Success criteria and renewal conditions

Initial values should be treated as testable assumptions rather than permanent business rules.

Final decisions must be based on real-world performance data, feedback from stores and users, and the long-term financial sustainability of the model.

## 14. Risks and Considerations

**Low initial traffic:** Stores may be reluctant to pay before GameXS demonstrates meaningful traffic volume. Free clicks and introductory discounts can reduce the initial barrier to collaboration.

**Failure to convert pilot stores into paying customers:** Free clicks alone do not indicate success. GameXS must determine whether stores are willing to pay after evaluating the quality of the referred traffic.

**High store acquisition costs:** Excessive free-click allowances or discounts that do not lead to continued collaboration may make store acquisition financially unsustainable.

**Disputes over click validity:** Transparent validation, tracking, and reporting rules are essential to minimize disputes.

**Discount complexity:** Overlapping promotions can complicate billing. Rules governing discount priority, stacking, and limits must be explicit.

**Impact on user trust:** Advertising must not distort price comparisons or misrepresent the actual purchasing conditions.

**Revenue concentration:** Over time, GameXS should diversify its partner base to avoid excessive dependence on a small number of stores.

## 15. Conclusion

The CPC model is a viable candidate for GameXS's primary revenue stream because it ties the commercial offering to a measurable outcome: referring interested users to partner stores.

The discount system should be treated as an independent commercial and promotional capability rather than a minor addition to pricing.

The ability to provide a configurable number of free initial clicks, apply percentage discounts, and choose between per-click and total-amount discounts gives GameXS the flexibility to attract new stores, test different commercial offers, and develop long-term partnerships.

The success of the model should not be measured by click volume alone. Traffic quality, stores' willingness to pay after promotional periods, partnership renewals, and long-term profitability must also be evaluated.

**Key principle:** All rates, discount percentages, free-click allowances, budgets, limits, and other numerical values in this proposal are variable. They must be continuously reviewed and optimized based on real-world data and feedback from users and partner stores.
