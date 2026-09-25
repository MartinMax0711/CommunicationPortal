-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "discordMessageIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "QuestionReply" ADD COLUMN     "discordMessageIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
