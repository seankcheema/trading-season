# Javadocs

Generated API documentation for the two Java services, regenerated and reviewed on 2026-10-05; Order and Sell was regenerated again on 2026-10-06. Open [index.html](index.html) for links into both. The generated output is refreshed only after successful generation and review.

Each service has its own directory. Both root their packages at `app` and share the names `account`, `auth`, `holding`, `instrument`, `market` and `user`, with different classes under them, so a single merged directory would silently overwrite one service's pages with the other's. Before this split the checked-in copy held the Order and Sell Service only, and changes to Holdings and Trade were not published at all.

| Service | Documentation | Source |
| --- | --- | --- |
| Holdings and Trade | [holdings-and-trade-service/index.html](holdings-and-trade-service/index.html) | [apps/holdings-and-trade-service](../../apps/holdings-and-trade-service) |
| Order and Sell | [order-and-sell-service/index.html](order-and-sell-service/index.html) | [apps/order-and-sell-service](../../apps/order-and-sell-service) |

## Regenerate

Run from the repository root. Each command writes to its service's own build output, which stays ignored; copy the result into this directory afterward, replacing that service's subdirectory completely so obsolete pages are removed.

| Service | Command | Source of the copied output |
| --- | --- | --- |
| Holdings and Trade | `mvn -B -f apps/holdings-and-trade-service/pom.xml org.apache.maven.plugins:maven-javadoc-plugin:3.11.2:javadoc` | `apps/holdings-and-trade-service/target/reports/apidocs` |
| Order and Sell | `mvn -B -f apps/order-and-sell-service/pom.xml org.apache.maven.plugins:maven-javadoc-plugin:3.11.2:javadoc` | `apps/order-and-sell-service/target/reports/apidocs` |

Review the changed class pages before copying, and never replace a checked-in subdirectory after failed generation. Do not edit these files by hand.

Generation currently reports warnings on pre-existing entity accessors and repository methods that carry no comment, in both services. Fix the warnings a change introduces rather than the whole backlog. Note that `javadoc` stops after 100 warnings by default, so a count at that ceiling is truncated rather than complete.

See [Development](../guides/development.md#javadocs) for where this sits in the check list.

[Documentation](../README.md)
