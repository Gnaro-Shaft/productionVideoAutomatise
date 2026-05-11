import 'dotenv/config';
import { PrismaClient, OrgRole } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('Seeding local org and user...');

  const org = await db.organization.upsert({
    where: { slug: 'local' },
    create: { name: 'Local Studio', slug: 'local' },
    update: {},
  });

  const user = await db.user.upsert({
    where: { email: 'me@local' },
    create: { email: 'me@local', name: 'Solo Director' },
    update: {},
  });

  await db.orgMember.upsert({
    where: { orgId_userId: { orgId: org.id, userId: user.id } },
    create: { orgId: org.id, userId: user.id, role: OrgRole.OWNER },
    update: {},
  });

  console.log(`Organization: ${org.id} (slug=${org.slug})`);
  console.log(`User:         ${user.id} (email=${user.email})`);
  console.log('');
  console.log('Add these to your .env:');
  console.log(`LOCAL_ORG_ID=${org.id}`);
  console.log(`LOCAL_USER_ID=${user.id}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
