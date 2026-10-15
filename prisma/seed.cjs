const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const email = "yasir@gmail.com";
  const password = await bcrypt.hash("786786786", 10);
  await prisma.user.upsert({
    where: { email },
    update: { password, role: "ADMIN", name: "Yasir" },
    create: {
      name: "Yasir",
      email,
      password,
      role: "ADMIN",
    },
  });
  console.log("Admin ready:", email);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
