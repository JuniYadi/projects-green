import { BaseSeeder, registerSeeder } from "@/lib/seeders"
import { seedOfficialAppTemplates } from "@/modules/deploy/app-template.seed"

export class AppTemplateSeeder extends BaseSeeder {
  static override readonly seederName = "AppTemplates"
  static override readonly classification = "system" as const
  static override readonly runOrder = 25
  static override readonly description =
    "Seed official platform marketplace app templates"

  async seed(): Promise<void> {
    this.log("Seeding official marketplace app templates...")
    const result = await seedOfficialAppTemplates({ prisma: this.prisma })
    this.trackCreated(result.count)
    this.log(
      `Successfully seeded ${result.count} official app templates: ${result.slugs.join(", ")}`
    )
  }

  override async unseed(): Promise<void> {
    this.log("Removing official marketplace app templates...")
    const deleted = await this.prisma.appTemplate.deleteMany({
      where: { isOfficial: true },
    })
    this.trackDeleted(deleted.count)
  }
}

registerSeeder(AppTemplateSeeder)
