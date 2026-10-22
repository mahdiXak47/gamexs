"""GameXS scraper package.

Error reporting: when SENTRY_DSN is set, every process that imports this
package (pipeline steps, seller runners, enrichment scripts) reports unhandled
exceptions to Sentry. https_proxy="" makes the SDK ignore HTTPS_PROXY: Sentry
is hosted in Iran (sentry.hamravesh.com), and the foreign proxy must not be
the reason an outage goes unreported.
"""

import os

if os.environ.get("SENTRY_DSN"):
    import sentry_sdk

    sentry_sdk.init(
        dsn=os.environ["SENTRY_DSN"],
        environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
        https_proxy="",
        send_default_pii=False,
    )
