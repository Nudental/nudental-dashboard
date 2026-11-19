
# Clinical package scanning

The reader is self-hosted ZXing-WASM 3.1.7. Its npm integrity, JS/WASM hashes and ZXing-C++ commit are recorded under public/vendor/zxing-wasm-3.1.7/provenance.json. No label image is uploaded by the scanner.

Phone camera and file decoding share the same reader. Receive requires the office, actual package count, product/reference, lot, expiry and size verification. Implant dimensions populate the existing diameter_label and length_label fields used in inventory and consumption. Graft dimensions, volume/unit, particle size and tissue bank are saved in package_details; donor ID also uses the existing donor_id column. Original scan text and receipt fields (supplier, order, cost) stay in the attributed movement content.

The known catalog match for GTIN 10841307107354 is Implant Direct 823710U, 3.7 × 10 mm, 3.5 mm platform. Source: https://www.implantdirect.com/en-us/catalog/implants/internal-hex-connection/simplylegacy2. The label's barcode encodes GTIN, expiration and lot, not dimensions. The manufacture date is not inferred from a GTIN or a different lot. Unknown products require label entry and confirmation. HIBC/ISBT codes may be captured as identifiers but are not interpreted as GS1.

Tests:
- Set IMPLANT_LABEL_PHOTO to the supplied clear DataMatrix photo (4).
- Set PLAYWRIGHT_PATH to an installed Playwright package, then run node tests/package-scanner.cjs.
- Run tests/package-metadata-rollback.sql through an authorized database connection. It verifies receiving, metadata conflicts, retry idempotency, office isolation, consumption, stock limits and unauthenticated denial. All synthetic records are inside one rolled-back transaction.
- Production is rebuilt from the latest published source, preserving the concurrent insurance-completion release, using the same verified production configuration.

Actual office phone focus/permissions and physical bone/tissue labels still require an office test. No live delivery or patient use was entered during verification.
